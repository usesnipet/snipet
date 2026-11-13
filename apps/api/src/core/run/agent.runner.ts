import { AgentRunStatus, RunEventType } from "@snipet/shared";
import {
  HookAction,
  HookName,
  HookToolErrorReason,
  LLMFinishReason,
  LLMMessagePartType,
  LLMRole,
  LLMStreamEventType,
} from "@snipet/shared/core";

import { clientMessage } from "../error.js";
import { HookRunner, HookStoppedError } from "../plugin/runner/hook.runner.js";

import type { Agent, AgentRun } from "@snipet/shared";
import type { LLMMessage, LLMMessageToolCallPart, LLMToolResult, LLMUsage } from "@snipet/shared/core";
import type { CoreContext } from "../context.js";
import type { LLMRunner } from "../llm/llm.runner.js";
import type { Logger } from "../logger.js";
import type { ToolRunner } from "../plugin/runner/tool.runner.js";
import type { MessageStore } from "../store/message.store.js";
import type { RunStore } from "../store/run.store.js";
import type { ContextResolver } from "./resolvers/context.resolver.js";
import type { HistoryResolver } from "./resolvers/history.resolver.js";
import type { PluginResolver, RunPlugins } from "./resolvers/plugin.resolver.js";
import type { TargetResolver } from "./resolvers/target.resolver.js";
import type { RunEvents } from "./run.events.js";

const INTERNAL_ERROR = "internal error";

/** The text parts of a message, joined. */
const textOf = (message: LLMMessage | undefined) =>
  message?.parts.flatMap((p) => (p.type === LLMMessagePartType.TEXT ? [p.text] : [])).join("\n") ?? "";

/** The message with its text parts replaced by `text`, its other parts kept. */
const withText = (message: LLMMessage, text: string): LLMMessage => ({
  ...message,
  parts: [{ type: LLMMessagePartType.TEXT, text }, ...message.parts.filter((p) => p.type !== LLMMessagePartType.TEXT)],
});

const toolCallsOf = (message: LLMMessage) =>
  message.parts.filter((p): p is LLMMessageToolCallPart => p.type === LLMMessagePartType.TOOL_CALL);

/**
 * The agent loop: call the models, run the tools they ask for, feed the
 * results back, until a reply without tool calls or maxTurns LLM calls.
 */
export class AgentRunner {
  constructor(
    private readonly runEvents: RunEvents,
    private readonly historyResolver: HistoryResolver,
    private readonly pluginResolver: PluginResolver,
    private readonly contextResolver: ContextResolver,
    private readonly targetResolver: TargetResolver,
    private readonly messageStore: MessageStore,
    private readonly runStore: RunStore,
    private readonly llmRunner: LLMRunner,
    private readonly logger: Logger,
  ) {}

  /**
   * Answers the session's history, which ends with the run's user message.
   * Never throws: the outcome is written to the run.
   */
  async run(ctx: CoreContext, agent: Agent, run: AgentRun): Promise<void> {
    // Opened before the first await, so a cancel right after start lands.
    const signal = this.runEvents.open(run.id);
    let plugins: RunPlugins | null = null;
    try {
      plugins = await this.pluginResolver.resolve(ctx, { agent, run });
    } catch (err) {
      this.logger.error(err);
    }
    // Without plugins the run still ends through run.end, on no handlers.
    const hooks = plugins?.hooks ?? new HookRunner([], { runId: run.id, owner: ctx.owner }, this.logger);
    await this.execute(ctx, agent, run, signal, hooks, plugins);
    await hooks.settle();
  }

  private async execute(
    ctx: CoreContext,
    agent: Agent,
    run: AgentRun,
    signal: AbortSignal,
    hooks: HookRunner,
    plugins: RunPlugins | null,
  ): Promise<void> {
    let status = AgentRunStatus.MAX_TURNS;
    let error: string | null = null;
    let turns = 0;
    let userInput = "";
    let history: LLMMessage[] = [];
    let runStart = 0;
    const usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const startedAt = Date.now();

    try {
      if (!plugins) throw new Error("the agent's plugins failed to load");
      history = await this.historyResolver.resolve(ctx, { agent, run });
      // The run's own messages start at the user's, the last of the history.
      runStart = Math.max(history.length - 1, 0);
      userInput = textOf(history.at(-1));
      await hooks.run(HookName.RUN_START, { input: userInput });

      const { payload: context } = await hooks.run(HookName.RUN_CONTEXT, {
        userInput,
        messages: this.contextResolver.resolve(ctx, { agent, instructions: plugins.instructions }),
        tools: plugins.tools.tools,
      });
      if (context.userInput !== userInput && history.length) {
        userInput = context.userInput;
        history[history.length - 1] = withText(history[history.length - 1], userInput);
      }
      const targets = await this.targetResolver.resolve(ctx, agent);

      while (turns < agent.maxTurns) {
        turns++;
        hooks.turn = turns;
        const reply = await this.callLLM(run, hooks, signal, {
          messages: [...context.messages, ...history],
          tools: context.tools,
          targets,
        });
        usage.inputTokens += reply.usage.inputTokens;
        usage.outputTokens += reply.usage.outputTokens;
        history.push(await this.save(ctx, run, reply.message, reply.model));

        const calls = toolCallsOf(reply.message);
        if (calls.length === 0) {
          status = AgentRunStatus.COMPLETED;
          break;
        }
        // Every call gets a result, even after a cancel, or the next run's
        // history would have calls the providers reject as unanswered.
        for (const asked of calls) {
          const result = await this.callTool(asked, plugins.tools, hooks, signal);
          // The result answers the call the model made, whatever a hook changed.
          const parts = [{ type: LLMMessagePartType.TOOL_RESULT as const, toolCallId: asked.id, ...result }];
          history.push(await this.save(ctx, run, { role: LLMRole.TOOL, parts }, null));
        }
        signal.throwIfAborted();
      }
    } catch (err) {
      if (signal.aborted) {
        status = AgentRunStatus.CANCELLED;
      } else {
        status = AgentRunStatus.FAILED;
        // Client-safe: a hook's stop reason is meant for the client; any other unexpected error is hidden.
        error = err instanceof HookStoppedError ? err.message : (clientMessage(err) ?? INTERNAL_ERROR);
        if (error === INTERNAL_ERROR) this.logger.error(err);
      }
    }
    hooks.status = status;
    try {
      await hooks.run(HookName.RUN_END, {
        status,
        error,
        userInput,
        messages: history.slice(runStart),
        turns,
        usage,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      // run.end accepts no stop, but a hook failure must not keep the run open.
      this.logger.warn(`run.end of run ${run.id}: ${String(err)}`);
    }

    try {
      const finished = await this.runStore.finish(ctx, run.id, { status, error, turns });
      this.runEvents.emit(run.id, { event: RunEventType.RUN_FINISHED, data: { run: finished } });
    } catch (err) {
      // The session was deleted mid-run.
      this.logger.warn(`finish agent run ${run.id}: ${String(err)}`);
    } finally {
      this.runEvents.close(run.id);
    }
  }

  /** One LLM call through llm.request and llm.response; a hook may answer it instead. */
  private async callLLM(
    run: AgentRun,
    hooks: HookRunner,
    signal: AbortSignal,
    request: {
      messages: LLMMessage[];
      tools: ToolRunner["tools"];
      targets: Awaited<ReturnType<TargetResolver["resolve"]>>;
    },
  ): Promise<{ message: LLMMessage; usage: LLMUsage; model: string | null }> {
    const started = Date.now();
    let message: LLMMessage | undefined;
    let model: string | null = null;
    let usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    const skipped: { model: string; error: string }[] = [];

    const outcome = await hooks.run(HookName.LLM_REQUEST, request);
    if (outcome.action === HookAction.RESPOND) message = outcome.result;
    else {
      const { messages, tools, targets } = outcome.payload;
      // Providers may reject an empty tool list.
      const stream = this.llmRunner.stream({ messages, targets, tools: tools.length ? tools : undefined, signal });
      for await (const event of stream) {
        if (event.event === LLMStreamEventType.LLM_STARTED) model = event.data.model;
        else if (event.event === LLMStreamEventType.LLM_SKIPPED) skipped.push(event.data);
        else if (event.event === LLMStreamEventType.TEXT_DELTA) {
          this.runEvents.emit(run.id, { event: RunEventType.TEXT_DELTA, data: event.data });
        } else if (event.event === LLMStreamEventType.USAGE) usage = event.data.usage;
        else if (event.event === LLMStreamEventType.MESSAGE) message = event.data.message;
      }
    }
    if (!message) throw new Error("llm stream ended without a message");

    const response = await hooks.run(HookName.LLM_RESPONSE, {
      message,
      // The stream doesn't carry the provider's finish reason, so it's told from the message.
      finishReason: toolCallsOf(message).length ? LLMFinishReason.TOOL_CALL : LLMFinishReason.STOP,
      usage,
      model,
      skipped,
      durationMs: Date.now() - started,
    });
    return { message: response.payload.message, usage, model };
  }

  /** Runs one tool call through tool.before and tool.after; throws only when a hook stops the run. */
  private async callTool(
    asked: LLMMessageToolCallPart,
    tools: ToolRunner,
    hooks: HookRunner,
    signal: AbortSignal,
  ): Promise<LLMToolResult> {
    const started = Date.now();
    if (signal.aborted) {
      const cancelled = { content: "cancelled", isError: true };
      return this.toolAfter(hooks, asked, cancelled, HookToolErrorReason.CANCELLED, started);
    }
    const before = await hooks.run(HookName.TOOL_BEFORE, { call: asked, tool: tools.sourceOf(asked.name) });
    if (before.action === HookAction.RESPOND) return before.result;
    if (before.action === HookAction.DENY) {
      const denied = { content: before.reason, isError: true };
      return this.toolAfter(hooks, asked, denied, HookToolErrorReason.DENIED, started);
    }
    const { call } = before.payload;
    const result = await tools.call(call);
    let reason: HookToolErrorReason | undefined;
    if (result.isError) {
      if (signal.aborted) reason = HookToolErrorReason.CANCELLED;
      else reason = tools.has(call.name) ? HookToolErrorReason.ERROR_RESULT : HookToolErrorReason.UNKNOWN_TOOL;
    }
    return this.toolAfter(hooks, call, result, reason, started);
  }

  /** Passes a tool's result through tool.after, which may change it. */
  private async toolAfter(
    hooks: HookRunner,
    call: LLMMessageToolCallPart,
    result: LLMToolResult,
    reason: HookToolErrorReason | undefined,
    started: number,
  ): Promise<LLMToolResult> {
    const outcome = await hooks.run(HookName.TOOL_AFTER, {
      call,
      result,
      durationMs: Date.now() - started,
      error: result.isError ? result.content : null,
      ...(reason && { reason }),
    });
    return outcome.payload.result;
  }

  /** Stores the message and sends it to the run's followers; returns it as the models see it. */
  private async save(ctx: CoreContext, run: AgentRun, message: LLMMessage, model: string | null): Promise<LLMMessage> {
    const stored = await this.messageStore.add(ctx, run, message, model);
    this.runEvents.emit(run.id, { event: RunEventType.MESSAGE, data: { message: stored } });
    return message;
  }
}
