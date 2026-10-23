import { toHttpException } from "#src/common/filter/llm-error.filter.js";
import { FailoverError, LlmError } from "#src/llm/errors.js";
import { ActionResult } from "#src/plugin/driver.js";
import { slugify } from "#src/utils/slug/slug.js";
import { HttpException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AgentRunStatus } from "@snipet/shared";
import moment from "moment";
import { Repository } from "typeorm";

import { Agent } from "../agent/agent.entity.js";
import { DebugService } from "../debug/debug.service.js";
import { Debugger, describeError } from "../debug/debugger.js";
import { LlmConnectionService } from "../llm-connection/llm-connection.service.js";

import { AgentMessage, AgentRun } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";
import { AgentContext } from "./agent-context.js";

import type { LlmMessage, LlmPart, LlmToolCallPart } from "@snipet/shared";
const HISTORY_LIMIT = 20;

const INTERNAL_ERROR = "internal error";

/**
 * Client-safe message for a failed run: LLM errors never carry the raw
 * provider message, which may hold hosts or credentials.
 */
function describe(err: unknown): string {
  if (err instanceof LlmError || err instanceof FailoverError) err = toHttpException(err);
  return err instanceof HttpException ? err.message : INTERNAL_ERROR;
}

/**
 * The agent loop: call the models, run the tools they ask for, feed the
 * results back, until a reply without tool calls or maxTurns LLM calls.
 */
@Injectable()
export class AgentRunner {
  private readonly logger = new Logger(AgentRunner.name);

  constructor(
    @InjectRepository(AgentRun) private readonly runs: Repository<AgentRun>,
    @InjectRepository(AgentMessage) private readonly messages: Repository<AgentMessage>,
    private readonly llm: LlmConnectionService,
    private readonly events: AgentRunEvents,
    private readonly agentContext: AgentContext,
    private readonly debugs: DebugService,
  ) {}

  /** The run's debug folder: <date>/<agent slug>_<agent id>/<session id>/<time>_<run id>. */
  private static debugPath(agent: Agent, run: AgentRun): string {
    const date = moment.utc(run.createdAt).format("YYYY-MM-DD");
    const time = moment.utc(run.createdAt).format("HH-mm-ss");
    return `${date}/${slugify(agent.name) || "agent"}_${agent.id}/${run.sessionId}/${time}_${run.id}`;
  }

  /** The session's last messages, from its first user message, with every tool call paired to its result. */
  private async getHistory(sessionId: string): Promise<LlmMessage[]> {
    const stored = await this.messages.find({
      where: { sessionId },
      order: { id: "DESC" },
      take: HISTORY_LIMIT,
    });
    stored.reverse();
    const firstUser = stored.findIndex((m) => m.role === "user");
    const messages = stored.slice(firstUser);
    // Providers reject calls without results and results without calls; the
    // history window or a crashed run can leave either.
    const all = messages.flatMap((m) => m.parts);
    const calls = new Set(all.flatMap((p) => (p.type === "tool_call" ? [p.id] : [])));
    const results = new Set(all.flatMap((p) => (p.type === "tool_result" ? [p.toolCallId] : [])));
    const paired = (p: LlmPart) =>
      p.type === "tool_call" ? results.has(p.id) : p.type === "tool_result" ? calls.has(p.toolCallId) : true;
    return messages
      .map(({ role, parts }) => ({ role, parts: parts.filter(paired) })) // the DB only holds valid messages
      .filter((m) => m.parts.length > 0);
  }

  /**
   * Answers the session's history, which ends with the run's user message.
   * Never throws: the outcome is written to the run.
   */
  async run(agent: Agent, run: AgentRun): Promise<void> {
    // Opened before the first await, so a cancel right after start lands.
    const signal = this.events.open(run.id);
    await this.debugs.debug(AgentRunner.debugPath(agent, run), run.debugged, (d) =>
      this.execute(agent, run, signal, d),
    );
  }

  private async execute(agent: Agent, run: AgentRun, signal: AbortSignal, d: Debugger): Promise<void> {
    let status = AgentRunStatus.MAX_TURNS;
    let error: string | null = null;
    let turns = 0;

    try {
      const history = await this.getHistory(run.sessionId);
      const context = await this.agentContext.build(agent);
      const { system, tools } = context;
      const targets = agent.llms.map((llm) => ({
        model: llm.model,
        connectionId: llm.connectionId ?? undefined,
        extraOptions: llm.extraOptions ?? undefined,
      }));
      d.update("agent", {
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        maxTurns: agent.maxTurns,
        llms: targets,
        pluginGrants: agent.pluginConnections,
      });
      d.update("tools", { available: tools ?? [], denied: context.denied, instructions: context.instructions });

      while (turns < agent.maxTurns) {
        turns++;
        let reply: LlmMessage | undefined;
        let model: string | null = null;
        const skipped: unknown[] = [];
        const messages = [...system, ...history];
        const started = Date.now();
        const stream = this.llm.stream({ targets, messages, tools }, signal);
        for await (const event of stream) {
          if (event.event === "llm_started") model = event.data.llm;
          else if (event.event === "llm_skipped") skipped.push(event.data);
          else if (event.event === "text_delta") this.events.emit(run.id, event);
          else if (event.event === "message") reply = event.data.message;
        }
        if (!reply) throw new Error("llm stream ended without a message");
        d.append("turns", { turn: turns, model, skipped, durationMs: Date.now() - started, messages, reply });
        history.push(await this.save(run, reply, model));

        const calls = reply.parts.filter((p): p is LlmToolCallPart => p.type === "tool_call");
        if (calls.length === 0) {
          status = AgentRunStatus.COMPLETED;
          break;
        }
        // Every call gets a result, even after a cancel, or the next run's
        // history would have calls the providers reject as unanswered.
        for (const call of calls) {
          const { result, startedAt, durationMs } = await d.time(() =>
            signal.aborted
              ? Promise.resolve<ActionResult>({ content: "cancelled", isError: true })
              : context.call(call),
          );
          d.append("toolCalls", { turn: turns, ...call, known: context.has(call.name), startedAt, durationMs, result });
          const parts = [{ type: "tool_result" as const, toolCallId: call.id, ...result }];
          history.push(await this.save(run, { role: "tool", parts }, null));
        }
        await d.save();
        signal.throwIfAborted();
      }
    } catch (err) {
      if (signal.aborted) {
        status = AgentRunStatus.CANCELLED;
      } else {
        status = AgentRunStatus.FAILED;
        error = describe(err);
        if (error === INTERNAL_ERROR) this.logger.error(err);
      }
      d.update("error", describeError(err)); // the raw error, which the client never sees
    }
    d.update("outcome", { status, error, turns });

    try {
      await this.runs.update(run.id, { status, error, turns, finishedAt: new Date() });
      this.events.emit(run.id, { event: "run_finished", data: await this.runs.findOneByOrFail({ id: run.id }) });
    } catch (err) {
      // The session was deleted mid-run.
      this.logger.warn(`finish agent run ${run.id}: ${String(err)}`);
    } finally {
      this.events.close(run.id);
    }
  }

  private async save(run: AgentRun, llmMessage: LlmMessage, model: string | null): Promise<LlmMessage> {
    const message = await this.messages.save(
      this.messages.create({ sessionId: run.sessionId, runId: run.id, ...llmMessage, model }),
    );
    this.events.emit(run.id, { event: "message", data: { ...message, ...llmMessage } });
    return llmMessage;
  }
}
