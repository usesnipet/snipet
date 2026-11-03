import { Owner } from "#src/common/decorators/owner.decorator.js";
import { toHttpException } from "#src/common/filter/llm-error.filter.js";
import { FailoverError, LlmError } from "#src/llm/errors.js";
import { ToolResult } from "#src/plugin/driver.js";
import { HttpException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AgentRunStatus } from "@snipet/shared";
import { In, Repository } from "typeorm";

import { Agent } from "../agent/agent.entity.js";
import { LlmConnectionService } from "../llm-connection/llm-connection.service.js";

import { AgentContext, RunContext } from "./agent-context.js";
import { AgentMessage, AgentRun } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";
import { HookDispatcher } from "./hooks/hook.dispatcher.js";
import { HookRunner, HookStoppedError } from "./hooks/hook.runner.js";

import type { HookToolErrorReason, LlmMessage, LlmUsage, LlmPart, LlmToolCallPart } from "@snipet/shared";

/** The last runs, the current one included, whose tool results the models see in full. */
const FULL_TOOL_RUNS = 2;

/** Stands in for an older tool result, which is mostly tokens the models no longer need. */
const OMITTED_RESULT = "[result omitted]";

const INTERNAL_ERROR = "internal error";

/**
 * Client-safe message for a failed run: LLM errors never carry the raw
 * provider message, which may hold hosts or credentials. A hook's stop
 * reason is meant for the client.
 */
function describe(err: unknown): string {
  if (err instanceof HookStoppedError) return err.message;
  if (err instanceof LlmError || err instanceof FailoverError) err = toHttpException(err);
  return err instanceof HttpException ? err.message : INTERNAL_ERROR;
}

/** The raw error, for hooks only: it may hold hosts or credentials the client must not see. */
function describeError(err: unknown) {
  return err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { message: String(err) };
}

/** The text parts of a message, joined. */
const textOf = (message: LlmMessage | undefined) =>
  message?.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n") ?? "";

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
    private readonly hooks: HookDispatcher,
  ) {}

  /**
   * The messages of the current run and the session's `previousRuns` before it, with every tool call paired
   * to its result. Tool results older than the last FULL_TOOL_RUNS runs are
   * replaced by a placeholder: the calls stay, so the model knows what it did.
   */
  private async getHistory(sessionId: string, previousRuns: number): Promise<LlmMessage[]> {
    const recent = await this.runs.find({
      select: { id: true },
      where: { sessionId },
      order: { createdAt: "DESC" },
      take: previousRuns + 1,
    });
    const messages = await this.messages.find({
      where: { runId: In(recent.map((r) => r.id)) },
      order: { id: "ASC" },
    });
    const full = new Set(recent.slice(0, FULL_TOOL_RUNS).map((r) => r.id));
    // Providers reject calls without results and results without calls; a
    // crashed run can leave either.
    const all = messages.flatMap((m) => m.parts);
    const calls = new Set(all.flatMap((p) => (p.type === "tool_call" ? [p.id] : [])));
    const results = new Set(all.flatMap((p) => (p.type === "tool_result" ? [p.toolCallId] : [])));
    const paired = (p: LlmPart) =>
      p.type === "tool_call" ? results.has(p.id) : p.type === "tool_result" ? calls.has(p.toolCallId) : true;
    return messages
      .map(({ role, parts, runId }) => ({
        role,
        parts: parts
          .filter(paired) // the DB only holds valid messages
          .map((p) => (p.type === "tool_result" && !full.has(runId) ? { ...p, content: OMITTED_RESULT } : p)),
      }))
      .filter((m) => m.parts.length > 0);
  }

  /**
   * Answers the session's history, which ends with the run's user message.
   * Never throws: the outcome is written to the run.
   */
  async run(agent: Agent, run: AgentRun, owner: Owner): Promise<void> {
    // Opened before the first await, so a cancel right after start lands.
    const signal = this.events.open(run.id);
    const hooks = await this.hooks.forRun({ run, agent, owner });
    await this.execute(agent, run, signal, hooks, owner);
    await hooks.settle();
  }

  private async execute(
    agent: Agent,
    run: AgentRun,
    signal: AbortSignal,
    hooks: HookRunner,
    owner: Owner,
  ): Promise<void> {
    let status = AgentRunStatus.MAX_TURNS;
    let error: string | null = null;
    let rawError: unknown = null;
    let turns = 0;
    let input = "";
    let output: string | null = null;
    let history: LlmMessage[] = [];
    let runStart = 0;
    const usage = { inputTokens: 0, outputTokens: 0 };
    const startedAt = Date.now();

    try {
      history = await this.getHistory(run.sessionId, agent.historyRuns);
      // The run's own messages start at the user's, the last of the history.
      runStart = Math.max(history.length - 1, 0);
      input = textOf(history.at(-1));
      await hooks.pass("run.start", { input });
      const context = await this.agentContext.build(agent, owner);
      const { system, tools } = await hooks.pass("run.context", {
        input,
        system: context.system,
        tools: context.tools ?? [],
      });
      const agentTargets = agent.llms.map((llm) => ({
        model: llm.model,
        connectionId: llm.connectionId ?? undefined,
        extraOptions: llm.extraOptions ?? undefined,
      }));

      while (turns < agent.maxTurns) {
        turns++;
        hooks.turn = turns;
        let reply: LlmMessage | undefined;
        let model: string | null = null;
        let turnUsage: LlmUsage | null = null;
        const skipped: unknown[] = [];
        const started = Date.now();
        const request = await hooks.call("llm.request", {
          messages: [...system, ...history],
          tools,
          targets: agentTargets,
        });
        // llm.request accepts no deny, so the outcome is continue or respond.
        if (request.action === "respond") reply = request.result;
        else if (request.action === "continue") {
          const { messages, targets } = request.payload;
          // Providers may reject an empty tool list.
          const offered = request.payload.tools.length ? request.payload.tools : undefined;
          const stream = this.llm.stream({ targets, messages, tools: offered }, signal);
          for await (const event of stream) {
            if (event.event === "llm_started") model = event.data.llm;
            else if (event.event === "llm_skipped") skipped.push(event.data);
            else if (event.event === "text_delta") this.events.emit(run.id, event);
            else if (event.event === "usage") turnUsage = event.data;
            else if (event.event === "message") reply = event.data.message;
          }
        }
        if (!reply) throw new Error("llm stream ended without a message");
        if (turnUsage) {
          usage.inputTokens += turnUsage.inputTokens;
          usage.outputTokens += turnUsage.outputTokens;
        }
        ({ message: reply } = await hooks.pass("llm.response", {
          model,
          message: reply,
          usage: turnUsage,
          skipped,
          durationMs: Date.now() - started,
        }));
        history.push(await this.save(run, reply, model));

        const calls = reply.parts.filter((p): p is LlmToolCallPart => p.type === "tool_call");
        if (calls.length === 0) {
          status = AgentRunStatus.COMPLETED;
          output = textOf(reply);
          break;
        }
        // Every call gets a result, even after a cancel, or the next run's
        // history would have calls the providers reject as unanswered.
        for (const asked of calls) {
          const result = await this.callTool(asked, context, hooks, signal);
          // The result answers the call the model made, whatever a hook changed.
          const parts = [{ type: "tool_result" as const, toolCallId: asked.id, ...result }];
          history.push(await this.save(run, { role: "tool", parts }, null));
        }
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
      rawError = err;
    }
    hooks.status = status;
    hooks.emit("run.end", {
      status,
      error,
      rawError: rawError === null ? null : describeError(rawError),
      input,
      messages: history.slice(runStart),
      output,
      turns,
      usage,
      durationMs: Date.now() - startedAt,
    });

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

  /** Runs one tool call through its hooks; throws only when a hook stops the run (HookStoppedError). */
  private async callTool(
    requestedCall: LlmToolCallPart,
    context: RunContext,
    hooks: HookRunner,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const started = Date.now();
    if (signal.aborted)
      return this.toolDone(hooks, requestedCall, { content: "cancelled", isError: true }, "cancelled", started);
    const beforeOutcome = await hooks.call("tool.before", {
      call: requestedCall,
      tool: context.toolOf(requestedCall.name),
    });
    if (beforeOutcome.action === "deny") {
      const denied = { content: beforeOutcome.reason, isError: true };
      return this.toolDone(hooks, requestedCall, denied, "denied", started);
    }
    if (beforeOutcome.action === "respond") return beforeOutcome.result;
    const { call } = beforeOutcome.payload;
    const { timedOut, ...result } = await context.call(call);
    const reason: HookToolErrorReason = signal.aborted
      ? "cancelled"
      : timedOut
        ? "timeout"
        : context.has(call.name)
          ? "error_result"
          : "unknown_tool";
    return this.toolDone(hooks, call, result, reason, started);
  }

  /** Passes a tool's result through tool.after, or tool.error when it is one. */
  private async toolDone(
    hooks: HookRunner,
    call: LlmToolCallPart,
    result: ToolResult,
    reason: HookToolErrorReason,
    started: number,
  ): Promise<ToolResult> {
    const durationMs = Date.now() - started;
    const outcome = result.isError
      ? await hooks.call("tool.error", { call, result, reason, durationMs })
      : await hooks.call("tool.after", { call, result, durationMs });
    // Neither accepts deny nor respond, so it's continue.
    return outcome.action === "continue" ? outcome.payload.result : result;
  }

  private async save(run: AgentRun, llmMessage: LlmMessage, model: string | null): Promise<LlmMessage> {
    const message = await this.messages.save(
      this.messages.create({ sessionId: run.sessionId, runId: run.id, ...llmMessage, model }),
    );
    this.events.emit(run.id, { event: "message", data: { ...message, ...llmMessage } });
    return llmMessage;
  }
}
