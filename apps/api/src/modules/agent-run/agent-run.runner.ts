import type { AppContext } from "#src/common/context/app-context.js";
import { clientMessage } from "#src/core/error.js";
import { ToolResult } from "#src/core/plugin/driver.js";
import { HttpException, Injectable, Logger } from "@nestjs/common";
import { AgentRunStatus } from "@snipet/shared";
import { EntityManager, EntityTarget, In, ObjectLiteral, Repository } from "typeorm";

import { Agent } from "../agent/agent.entity.js";
import { LlmConnectionService } from "../llm-connection/llm-connection.service.js";

import { AgentContext, RunContext } from "./agent-context.js";
import { AgentMessage, AgentRun } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";
import { HookDispatcher } from "./hooks/hook.dispatcher.js";
import { HookRunner, HookStoppedError } from "./hooks/hook.runner.js";

import type { HookToolErrorReason, LlmUsage, LlmPart, LlmToolCallPart, LlmMessage } from "@snipet/shared";

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
  // HttpException: the Nest exceptions still thrown by the plugin services, until they become CoreErrors.
  return clientMessage(err) ?? (err instanceof HttpException ? err.message : INTERNAL_ERROR);
}

/** The raw error, for hooks only: it may hold hosts or credentials the client must not see. */
function describeError(err: unknown): { name?: string; message: string; stack?: string; cause?: unknown } {
  if (!(err instanceof Error)) return { message: String(err) };
  const cause = err.cause === undefined ? {} : { cause: describeError(err.cause) };
  return { name: err.name, message: err.message, stack: err.stack, ...cause };
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
    private readonly manager: EntityManager,
    private readonly llmConnectionService: LlmConnectionService,
    private readonly runEvents: AgentRunEvents,
    private readonly agentContext: AgentContext,
    private readonly hookDispatcher: HookDispatcher,
  ) {}

  /** A table, joining the context's transaction when there is one. */
  private repositoryOf<E extends ObjectLiteral>(ctx: AppContext, target: EntityTarget<E>): Repository<E> {
    return (ctx.tx ?? this.manager).getRepository(target);
  }

  /**
   * The messages of the current run and the session's `previousRuns` before it, with every tool call paired
   * to its result. Tool results older than the last FULL_TOOL_RUNS runs are
   * replaced by a placeholder: the calls stay, so the model knows what it did.
   */
  private async getHistory(ctx: AppContext, sessionId: string, previousRuns: number): Promise<LlmMessage[]> {
    const recentRuns = await this.repositoryOf(ctx, AgentRun).find({
      select: { id: true },
      where: { sessionId },
      order: { createdAt: "DESC" },
      take: previousRuns + 1,
    });
    const messages = await this.repositoryOf(ctx, AgentMessage).find({
      where: { runId: In(recentRuns.map((r) => r.id)) },
      order: { id: "ASC" },
    });
    const runIdsWithFullTools = new Set(recentRuns.slice(0, FULL_TOOL_RUNS).map((r) => r.id));
    // Providers reject calls without results and results without calls; a
    // crashed run can leave either.
    const all = messages.flatMap((m) => m.parts);
    const calls = new Set(all.flatMap((p) => (p.type === "tool_call" ? [p.id] : [])));
    const results = new Set(all.flatMap((p) => (p.type === "tool_result" ? [p.toolCallId] : [])));
    /** Whether a part is paired to a tool call or result. */
    const paired = (p: LlmPart) => {
      if (p.type === "tool_call") return results.has(p.id);
      if (p.type === "tool_result") return calls.has(p.toolCallId);
      return true;
    };
    return messages
      .map(({ role, parts, runId }) => ({
        role,
        parts: parts.filter(paired).map((p) => {
          if (p.type === "tool_result" && !runIdsWithFullTools.has(runId)) return { ...p, content: OMITTED_RESULT };
          return p;
        }),
      }))
      .filter((m) => m.parts.length > 0);
  }

  /**
   * Answers the session's history, which ends with the run's user message.
   * Never throws: the outcome is written to the run.
   */
  async run(ctx: AppContext, agent: Agent, run: AgentRun): Promise<void> {
    // Opened before the first await, so a cancel right after start lands.
    const signal = this.runEvents.open(run.id);
    const hookRunner = await this.hookDispatcher.forRun(ctx, run, agent);
    await this.execute(ctx, agent, run, signal, hookRunner);
    await hookRunner.settle();
  }

  private async execute(
    ctx: AppContext,
    agent: Agent,
    run: AgentRun,
    signal: AbortSignal,
    hookRunner: HookRunner,
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
      history = await this.getHistory(ctx, run.sessionId, agent.historyRuns);
      // The run's own messages start at the user's, the last of the history.
      runStart = Math.max(history.length - 1, 0);
      input = textOf(history.at(-1));
      await hookRunner.run("run.start", { input });
      const context = await this.agentContext.build(ctx, agent);
      const {
        payload: { system, tools },
      } = await hookRunner.run("run.context", {
        input,
        system: context.system,
        tools: context.tools ?? [],
      });
      const agentTargets = agent.llms.map(({ connectionId, model }) => ({ connectionId, model }));

      while (turns < agent.maxTurns) {
        turns++;
        hookRunner.turn = turns;
        let reply: LlmMessage | undefined;
        let model: string | null = null;
        let turnUsage: LlmUsage | null = null;
        const skipped: unknown[] = [];
        const started = Date.now();
        const request = await hookRunner.run("llm.request", {
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
          const stream = this.llmConnectionService.stream(ctx, { targets, messages, tools: offered }, signal);
          for await (const event of stream) {
            if (event.event === "llm_started") model = event.data.model;
            else if (event.event === "llm_skipped") skipped.push(event.data);
            else if (event.event === "text_delta") this.runEvents.emit(run.id, event);
            else if (event.event === "usage") turnUsage = event.data;
            else if (event.event === "message") reply = event.data.message;
          }
        }
        if (!reply) throw new Error("llm stream ended without a message");
        if (turnUsage) {
          usage.inputTokens += turnUsage.inputTokens;
          usage.outputTokens += turnUsage.outputTokens;
        }
        ({
          payload: { message: reply },
        } = await hookRunner.run("llm.response", {
          model,
          message: reply,
          usage: turnUsage,
          skipped,
          durationMs: Date.now() - started,
        }));
        history.push(await this.save(ctx, run, reply, model));

        const calls = reply.parts.filter((p): p is LlmToolCallPart => p.type === "tool_call");
        if (calls.length === 0) {
          status = AgentRunStatus.COMPLETED;
          output = textOf(reply);
          break;
        }
        // Every call gets a result, even after a cancel, or the next run's
        // history would have calls the providers reject as unanswered.
        for (const asked of calls) {
          const result = await this.callTool(ctx, asked, context, hookRunner, signal);
          // The result answers the call the model made, whatever a hook changed.
          const parts = [{ type: "tool_result" as const, toolCallId: asked.id, ...result }];
          history.push(await this.save(ctx, run, { role: "tool", parts }, null));
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
    hookRunner.status = status;
    await hookRunner.run("run.end", {
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
      const runs = this.repositoryOf(ctx, AgentRun);
      await runs.update(run.id, { status, error, turns, finishedAt: new Date() });
      this.runEvents.emit(run.id, { event: "run_finished", data: await runs.findOneByOrFail({ id: run.id }) });
    } catch (err) {
      // The session was deleted mid-run.
      this.logger.warn(`finish agent run ${run.id}: ${String(err)}`);
    } finally {
      this.runEvents.close(run.id);
    }
  }

  /** Runs one tool call through its hooks; throws only when a hook stops the run (HookStoppedError). */
  private async callTool(
    ctx: AppContext,
    requestedCall: LlmToolCallPart,
    context: RunContext,
    hookRunner: HookRunner,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const started = Date.now();
    if (signal.aborted)
      return this.toolDone(
        ctx,
        hookRunner,
        requestedCall,
        { content: "cancelled", isError: true },
        "cancelled",
        started,
      );
    const beforeOutcome = await hookRunner.run("tool.before", {
      call: requestedCall,
      tool: context.toolOf(requestedCall.name),
    });
    if (beforeOutcome.action === "deny") {
      const denied = { content: beforeOutcome.reason, isError: true };
      return this.toolDone(ctx, hookRunner, requestedCall, denied, "denied", started);
    }
    if (beforeOutcome.action === "respond") return beforeOutcome.result;
    const { call } = beforeOutcome.payload;
    const result = await context.call(call);
    let reason: HookToolErrorReason;
    if (signal.aborted) reason = "cancelled";
    else if (context.has(call.name)) reason = "error_result";
    else reason = "unknown_tool";
    return this.toolDone(ctx, hookRunner, call, result, reason, started);
  }

  /** Passes a tool's result through tool.after, or tool.error when it is one. */
  private async toolDone(
    _ctx: AppContext,
    hookRunner: HookRunner,
    call: LlmToolCallPart,
    result: ToolResult,
    reason: HookToolErrorReason,
    started: number,
  ): Promise<ToolResult> {
    const durationMs = Date.now() - started;
    const outcome = result.isError
      ? await hookRunner.run("tool.error", { call, result, reason, durationMs })
      : await hookRunner.run("tool.after", { call, result, durationMs });
    return outcome.payload.result;
  }

  private async save(
    ctx: AppContext,
    run: AgentRun,
    llmMessage: LlmMessage,
    model: string | null,
  ): Promise<LlmMessage> {
    const messages = this.repositoryOf(ctx, AgentMessage);
    const message = await messages.save(
      messages.create({ sessionId: run.sessionId, runId: run.id, ...llmMessage, model }),
    );
    this.runEvents.emit(run.id, { event: "message", data: message });
    return llmMessage;
  }
}
