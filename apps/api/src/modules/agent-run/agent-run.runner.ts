import { toHttpException } from "#src/common/filter/llm-error.filter.js";
import { FailoverError, LlmError } from "#src/llm/errors.js";
import { ActionResult } from "#src/plugin/driver.js";
import { isGranted } from "#src/utils/grant/grant.js";
import { HttpException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AgentRunStatus } from "@snipet/shared";
import { Repository } from "typeorm";

import { Agent } from "../agent/agent.entity.js";
import { DebugService } from "../debug/debug.service.js";
import { Debugger, describeError } from "../debug/debugger.js";
import { LlmConnectionService } from "../llm-connection/llm-connection.service.js";
import { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";

import { AgentMessage, AgentRun } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";

import type { Owner } from "#src/common/decorators/owner.decorator.js";
import type { LlmMessage, LlmPart, LlmToolCallPart, LlmTool } from "@snipet/shared";

const HISTORY_LIMIT = 20;

type Executor = (args: Record<string, unknown>) => Promise<ActionResult>;
type DeniedAction = { action: string; pluginConnectionId: string };

const INTERNAL_ERROR = "internal error";

// Client-safe message for a failed run: LLM errors never carry the raw
// provider message, which may hold hosts or credentials.
function describe(err: unknown): string {
  if (err instanceof LlmError || err instanceof FailoverError) err = toHttpException(err);
  return err instanceof HttpException ? err.message : INTERNAL_ERROR;
}

function debugPath(agent: Agent, run: AgentRun): string {
  const iso = run.createdAt.toISOString();
  const slug =
    agent.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/^-+|-+$/g, "") || "agent";
  const time = iso.slice(11, 19).replaceAll(":", "-");
  return `${iso.slice(0, 10)}/${slug}_${agent.id}/${run.sessionId}/${time}_${run.id}`;
}

// The agent loop: call the models, run the tools they ask for, feed the
// results back, until a reply without tool calls or maxTurns LLM calls.
@Injectable()
export class AgentRunner {
  private readonly logger = new Logger(AgentRunner.name);

  constructor(
    @InjectRepository(AgentRun) private readonly runs: Repository<AgentRun>,
    @InjectRepository(AgentMessage) private readonly messages: Repository<AgentMessage>,
    private readonly llm: LlmConnectionService,
    private readonly events: AgentRunEvents,
    private readonly plugins: PluginConnectionService,
    private readonly debugs: DebugService,
  ) {}

  // The session's last messages, plus what was left out of them for the
  // debug files.
  private async getHistory(sessionId: string) {
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
    const history: LlmMessage[] = messages
      .map(({ role, parts }) => ({ role, parts: parts.filter(paired) })) // the DB only holds valid messages
      .filter((m) => m.parts.length > 0);
    const dropped = {
      limit: HISTORY_LIMIT,
      loaded: stored.length,
      beforeFirstUser: firstUser,
      unpairedParts: all.length - history.reduce((n, m) => n + m.parts.length, 0),
    };
    return { history, dropped };
  }

  // Answers the session's history, which ends with the run's user message.
  // Never throws: the outcome is written to the run.
  async run(agent: Agent, run: AgentRun, owner: Owner): Promise<void> {
    // Opened before the first await, so a cancel right after start lands.
    const signal = this.events.open(run.id);
    await this.debugs.debug(debugPath(agent, run), (d) => this.execute(agent, run, owner, signal, d));
  }

  private async execute(agent: Agent, run: AgentRun, owner: Owner, signal: AbortSignal, d: Debugger): Promise<void> {
    let status = AgentRunStatus.MAX_TURNS;
    let error: string | null = null;
    let turns = 0;

    try {
      d.update("run", { id: run.id, sessionId: run.sessionId, startedAt: run.createdAt, owner });
      const { history, dropped } = await this.getHistory(run.sessionId);
      if (dropped.loaded > 0) d.update("historyDropped", dropped);
      const system: LlmMessage[] = [{ role: "system", parts: [{ type: "text", text: `Your name is ${agent.name}` }] }];
      if (agent.systemPrompt) system.push({ role: "system", parts: [{ type: "text", text: agent.systemPrompt }] });

      const { tools, executors, denied } = await this.resolveTools(agent);
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
      d.update("tools", { available: tools ?? [], denied });
      if (d.enabled) {
        this.logger.log(`debugging conversation ${run.id}`);
        this.events.emit(run.id, {
          event: "message",
          data: {
            id: 0,
            sessionId: run.sessionId,
            runId: run.id,
            role: "assistant",
            parts: [{ type: "text", text: "This conversation is being debugged and is not private." }],
            model: null,
            createdAt: new Date(),
          },
        });
      }

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
          const execute = executors.get(call.name);
          const { result, startedAt, durationMs } = await d.time(() =>
            signal.aborted
              ? Promise.resolve<ActionResult>({ content: "cancelled", isError: true })
              : this.callTool(execute, call),
          );
          d.append("toolCalls", { turn: turns, ...call, known: !!execute, startedAt, durationMs, result });
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

  private async callTool(execute: Executor | undefined, call: LlmToolCallPart): Promise<ActionResult> {
    if (!execute) return { content: `unknown tool "${call.name}"`, isError: true };
    try {
      return await execute((call.arguments ?? {}) as Record<string, unknown>);
    } catch (err) {
      return { content: err instanceof Error ? err.message : String(err), isError: true };
    }
  }

  // Native tools, plus the tools of the agent's actions of its plugin
  // connections that pass the grant's allow/deny; the others are returned as
  // denied. Names are made unique and provider-safe; executors maps them back.
  private async resolveTools(
    agent: Agent,
  ): Promise<{ tools?: LlmTool[]; executors: Map<string, Executor>; denied: DeniedAction[] }> {
    const denied: DeniedAction[] = [];
    const executors = new Map<string, Executor>();
    const tools: LlmTool[] = [];
    const add = (rawName: string, description: string, parameters: Record<string, unknown>, execute: Executor) => {
      const base = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      let name = base;
      for (let n = 2; executors.has(name); n++) name = `${base}_${n}`;
      executors.set(name, execute);
      tools.push({ name, description, parameters });
    };

    const pluginGrants = new Map((agent.pluginConnections ?? []).map((g) => [g.pluginConnectionId, g]));
    for (const action of await this.plugins.findActions([...pluginGrants.keys()])) {
      if (!isGranted(action.name, pluginGrants.get(action.pluginConnectionId)!)) {
        denied.push({ action: action.name, pluginConnectionId: action.pluginConnectionId });
        continue;
      }
      add(action.name, action.description, action.inputSchema, (args) => this.plugins.executeAction(action.id, args));
    }
    return { tools: tools.length ? tools : undefined, executors, denied };
  }
}
