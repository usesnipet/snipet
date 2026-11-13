import { AgentRunStatus, RunEventType } from "@snipet/shared";
import {
  hookHandlerSchema,
  HookAction,
  HookName,
  LLMMessagePartType,
  LLMRole,
  LLMStreamEventType,
} from "@snipet/shared/core";

import { HookRunner } from "../plugin/runner/hook.runner.js";
import { ToolRunner } from "../plugin/runner/tool.runner.js";

import { AgentRunner } from "./agent.runner.js";
import { ContextResolver } from "./resolvers/context.resolver.js";
import { RunEvents } from "./run.events.js";

import type { Agent, AgentMessage, AgentRun, RunEvent } from "@snipet/shared";
import type { HookEvent, LLMMessage, LLMStreamEvent } from "@snipet/shared/core";
import type { CoreContext } from "../context.js";
import type { LLMRunner } from "../llm/llm.runner.js";
import type { HookDriver } from "../plugin/driver.js";
import type { BoundHandler } from "../plugin/runner/hook.runner.js";
import type { MessageStore } from "../store/message.store.js";
import type { RunOutcome, RunStore } from "../store/run.store.js";
import type { HistoryResolver } from "./resolvers/history.resolver.js";
import type { PluginResolver } from "./resolvers/plugin.resolver.js";
import type { TargetResolver } from "./resolvers/target.resolver.js";

const ctx = { owner: { userId: "u1", appId: null, externalUserId: null, name: null }, requestId: "q1" } as CoreContext;
const agent = { name: "Bot", systemPrompt: "", maxTurns: 3, llms: [], pluginConnections: [] } as unknown as Agent;
const run = { id: "r1", sessionId: "s1" } as AgentRun;
const logger = { log() {}, warn() {}, error() {} };
const user: LLMMessage = { role: LLMRole.USER, parts: [{ type: LLMMessagePartType.TEXT, text: "hi" }] };

const text = (value: string): LLMMessage => ({
  role: LLMRole.ASSISTANT,
  parts: [{ type: LLMMessagePartType.TEXT, text: value }],
});
const toolCall = (name: string): LLMMessage => ({
  role: LLMRole.ASSISTANT,
  parts: [{ type: LLMMessagePartType.TOOL_CALL, id: `call-${name}`, name, arguments: {} }],
});

/** A hook handler of plugin "p" on `hook` that answers with `reply`. */
function hookOn(hook: HookName, reply: (event: HookEvent) => unknown): BoundHandler {
  const driver = { handle: (event: HookEvent) => Promise.resolve(reply(event)) } as unknown as HookDriver;
  return {
    plugin: { id: "p", name: "P" },
    hook,
    handler: hookHandlerSchema.parse({}),
    driver,
    options: {},
    settings: {},
  };
}

/** A runner whose model answers each turn with the next of `replies`, with `handlers` and a "search" tool. */
function setup(replies: LLMMessage[], handlers: BoundHandler[] = [], plugins: "ok" | "fail" = "ok") {
  const saved: AgentMessage[] = [];
  const outcomes: RunOutcome[] = [];
  const events: RunEvent[] = [];
  const executed: string[] = [];
  const runEvents = new RunEvents();

  const tools = new ToolRunner([
    {
      tool: { name: "search", description: "", inputSchema: {} },
      source: { id: "p", name: "P" },
      execute: () => {
        executed.push("search");
        return Promise.resolve({ content: "found", isError: false });
      },
    },
  ]);
  const pluginResolver = {
    resolve: () =>
      plugins === "fail"
        ? Promise.reject(new Error("db down"))
        : Promise.resolve({
            tools,
            hooks: new HookRunner(handlers, { runId: run.id, owner: ctx.owner }, logger),
            denied: [],
            instructions: [],
          }),
  } as unknown as PluginResolver;
  const llmRunner = {
    // eslint-disable-next-line @typescript-eslint/require-await -- fake stream
    async *stream(): AsyncGenerator<LLMStreamEvent> {
      const message = replies.shift()!;
      yield { event: LLMStreamEventType.LLM_STARTED, data: { model: "m" } };
      yield { event: LLMStreamEventType.USAGE, data: { usage: { inputTokens: 2, outputTokens: 1 } } };
      yield { event: LLMStreamEventType.MESSAGE, data: { message } };
    },
  } as unknown as LLMRunner;
  const messageStore: MessageStore = {
    listRecent: () => Promise.resolve([]),
    add: (_ctx, { id: runId, sessionId }, message, model) => {
      const stored = { ...message, id: saved.length + 1, runId, sessionId, model, createdAt: new Date() };
      saved.push(stored);
      return Promise.resolve(stored);
    },
  };
  const runStore: RunStore = {
    finish: (_ctx, id, outcome) => {
      outcomes.push(outcome);
      return Promise.resolve({ ...run, id, ...outcome } as AgentRun);
    },
  };
  const runner = new AgentRunner(
    runEvents,
    { resolve: () => Promise.resolve([user]) } as unknown as HistoryResolver,
    pluginResolver,
    new ContextResolver(),
    { resolve: () => Promise.resolve([]) } as unknown as TargetResolver,
    messageStore,
    runStore,
    llmRunner,
    logger,
  );
  const start = async () => {
    const running = runner.run(ctx, agent, run);
    runEvents.subscribe(run.id, (event) => events.push(event));
    await running;
  };
  return { start, saved, outcomes, events, executed };
}

describe("AgentRunner", () => {
  it("completes on a reply without tool calls, storing and streaming it", async () => {
    const { start, saved, outcomes, events } = setup([text("hello")]);
    await start();
    expect(saved.map((m) => m.parts)).toEqual([text("hello").parts]);
    expect(outcomes).toEqual([{ status: AgentRunStatus.COMPLETED, error: null, turns: 1 }]);
    expect(events.map((e) => e.event)).toEqual([RunEventType.MESSAGE, RunEventType.RUN_FINISHED]);
  });

  it("runs the tools the model calls and feeds their results back", async () => {
    const { start, saved, outcomes, executed } = setup([toolCall("search"), text("done")]);
    await start();
    expect(executed).toEqual(["search"]);
    expect(saved.map((m) => m.role)).toEqual([LLMRole.ASSISTANT, LLMRole.TOOL, LLMRole.ASSISTANT]);
    expect(saved[1].parts).toEqual([
      { type: LLMMessagePartType.TOOL_RESULT, toolCallId: "call-search", content: "found", isError: false },
    ]);
    expect(outcomes[0]).toMatchObject({ status: AgentRunStatus.COMPLETED, turns: 2 });
  });

  it("answers a denied call with the reason, without running the tool", async () => {
    const deny = hookOn(HookName.TOOL_BEFORE, () => ({ action: HookAction.DENY, reason: "not allowed" }));
    const { start, saved, executed } = setup([toolCall("search"), text("ok")], [deny]);
    await start();
    expect(executed).toEqual([]);
    expect(saved[1].parts).toEqual([
      { type: LLMMessagePartType.TOOL_RESULT, toolCallId: "call-search", content: "not allowed", isError: true },
    ]);
  });

  it("fails with a hook's stop reason, and still runs run.end", async () => {
    const ends: unknown[] = [];
    const stop = hookOn(HookName.RUN_START, () => ({ action: HookAction.STOP, reason: "over budget" }));
    const end = hookOn(HookName.RUN_END, (event) => {
      ends.push(event.payload);
      return { action: HookAction.CONTINUE };
    });
    const { start, outcomes } = setup([text("never")], [stop, end]);
    await start();
    expect(outcomes).toEqual([{ status: AgentRunStatus.FAILED, error: "over budget", turns: 0 }]);
    expect(ends).toEqual([expect.objectContaining({ status: AgentRunStatus.FAILED, error: "over budget" })]);
  });

  it("stops at maxTurns while the model keeps calling tools, and hides unexpected errors", async () => {
    const looping = setup([toolCall("search"), toolCall("search"), toolCall("search")]);
    await looping.start();
    expect(looping.outcomes[0]).toMatchObject({ status: AgentRunStatus.MAX_TURNS, turns: 3 });

    const broken = setup([], [], "fail");
    await broken.start();
    expect(broken.outcomes).toEqual([{ status: AgentRunStatus.FAILED, error: "internal error", turns: 0 }]);
  });
});
