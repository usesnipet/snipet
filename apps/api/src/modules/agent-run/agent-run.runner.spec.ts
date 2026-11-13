import { AppContext } from "#src/common/context/app-context.js";
import { LLMErrorCode, llmProviderError } from "#src/core/llm/errors.js";
import { jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { AgentRunStatus, Role } from "@snipet/shared";
import { hookHandlerSchema, hookNameSchema, HOOKS } from "@snipet/shared/core";

import { HookRunner } from "../../core/plugin/hooks/hook.runner.js";
import { AgentRunner } from "../../core/run/agent.runner.js";
import { AgentContext } from "../../core/run/resolvers/context.resolver.js";
import { RunEvents } from "../../core/run/run.events.js";
import { AgentMessage } from "../agent-session/agent-message.entity.js";

import { AgentRun } from "./agent-run.entity.js";

import type { HookEvent, HookResult, LLMMessage, LLMStreamEvent } from "@snipet/shared/core";

import type { Agent } from "../agent/agent.entity.js";
import type { HookDriver } from "#src/core/plugin/driver.js";
import type { HookDispatcher } from "../../core/plugin/hooks/hook.dispatcher.js";
import type { LlmConnectionService } from "../llm-connection/llm-connection.service.js";
import type { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";
import type { EntityManager } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;

const callTool: LLMMessage = {
  role: "assistant",
  parts: [{ type: "tool_call", id: "c1", name: "ask_question", arguments: { q: "x" } }],
};
const answer: LLMMessage = { role: "assistant", parts: [{ type: "text", text: "done" }] };

const agent = {
  id: "ag1",
  name: "Suporte Técnico",
  systemPrompt: "be brief",
  maxTurns: 5,
  historyRuns: 10,
  llms: [{ model: "gpt", connectionId: "c1" }],
  pluginConnections: [{ pluginConnectionId: "p1", tools: ["ask_question"] }],
} as unknown as Agent;
const run = { id: "r1", sessionId: "s1", createdAt: new Date("2026-10-16T14:32:05Z") } as AgentRun;

/** A logged-in user's context, so ctx.owner is that user. */
const userCtx = (name: string | null = null) =>
  AppContext.create("test").withAuth({ type: "user", user: { id: "u1", role: Role.User, name } });
const ctx = userCtx();

const wiki = { connection: { id: "p1", name: "Wiki" } };

/**
 * replies: what the model answers on each turn; an Error is thrown instead.
 * reply: what the hooks answer to each event.
 */
function setup(
  replies: (LLMMessage | Error)[],
  reply: (event: HookEvent) => HookResult = () => ({ action: "continue" }),
) {
  let nextId = 1;
  const saved: LLMMessage[] = [];
  const messages = {
    find: jest.fn<Fn>().mockResolvedValue([{ runId: "r1", role: "user", parts: [{ type: "text", text: "hi" }] }]),
    create: (m: unknown) => m,
    save: jest.fn((m: LLMMessage) => {
      saved.push({ role: m.role, parts: m.parts });
      return Promise.resolve({ ...m, id: nextId++ });
    }),
  };
  const runs = {
    find: jest.fn<Fn>().mockResolvedValue([{ id: "r1" }]),
    update: jest.fn<Fn>(),
    findOneByOrFail: jest.fn<Fn>().mockResolvedValue(run),
  };
  const llm = {
    stream: jest.fn(async function* (): AsyncGenerator<LLMStreamEvent> {
      const reply = await Promise.resolve(replies.shift()!);
      if (reply instanceof Error) throw reply;
      yield { event: "llm_started", data: { model: "gpt" } };
      yield { event: "message", data: { message: reply } };
    }),
  };
  const plugins = {
    findTools: jest.fn<Fn>().mockResolvedValue([
      { name: "ask_question", description: "Asks", inputSchema: {}, ...wiki },
      { name: "read_wiki", description: "", inputSchema: {}, ...wiki },
    ]),
    executeTool: jest.fn<Fn>().mockResolvedValue({ content: "answer", isError: false }),
    findInstructions: jest.fn<Fn>().mockResolvedValue([]),
  };

  // Every event the hooks got, through one synchronous handler bound to each.
  const events: HookEvent[] = [];
  const driver = {
    handle: (event: HookEvent) => {
      events.push(event);
      return Promise.resolve(reply(event));
    },
  } as unknown as HookDriver;
  const handlers = hookNameSchema.options.map((hook) => ({
    plugin: { id: "p9", name: "rec" },
    hook,
    handler: hookHandlerSchema.parse({ hook, actions: HOOKS[hook].actions }),
    driver,
    options: {},
    settings: {},
  }));
  const hooks = {
    forRun: (ctx: AppContext, run: AgentRun, agent: Agent) =>
      Promise.resolve(new HookRunner(handlers, { run, agent, owner: ctx.owner })),
  } as unknown as HookDispatcher;

  const runner = new AgentRunner(
    {
      getRepository: (target: unknown) => (target === AgentRun ? runs : target === AgentMessage ? messages : undefined),
    } as unknown as EntityManager,
    llm as unknown as LlmConnectionService,
    new RunEvents(),
    new AgentContext(plugins as unknown as PluginConnectionService),
    hooks,
  );
  return { runner, runs, messages, llm, plugins, saved, events };
}

const finishedWith = (runs: { update: jest.Mock<Fn> }) => runs.update.mock.calls[0][1];

describe("AgentRunner.run", () => {
  it("runs the granted plugin actions the model calls and feeds the results back", async () => {
    const { runner, runs, llm, plugins, saved } = setup([callTool, answer]);
    await runner.run(ctx, agent, run);

    expect(plugins.executeTool).toHaveBeenCalledWith(ctx, "p1", expect.objectContaining({ name: "ask_question" }), {
      q: "x",
    });
    expect(saved.map((m) => m.role)).toEqual(["assistant", "tool", "assistant"]);
    expect(saved[1].parts).toEqual([{ type: "tool_result", toolCallId: "c1", content: "answer", isError: false }]);
    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.COMPLETED, turns: 2, error: null });

    const [{ messages, tools }] = llm.stream.mock.calls[1].slice(1) as unknown as [
      { messages: LLMMessage[]; tools: { name: string; description: string }[] },
    ];
    expect(messages.map((m) => m.role)).toEqual(["system", "system", "user", "assistant", "tool"]);
    // read_wiki isn't selected in the plugin grant.
    expect(tools.map((t) => [t.name, t.description])).toEqual([["ask_question", "[Wiki] Asks"]]);
    expect(plugins.findTools).toHaveBeenCalledWith(ctx, ["p1"]);
  });

  it("adds the instructions of the plugins with granted actions after the system prompt", async () => {
    const { runner, llm, plugins } = setup([answer]);
    plugins.findInstructions.mockResolvedValue([{ name: 'Wiki "docs"', text: "search first" }]);
    await runner.run(ctx, agent, run);

    expect(plugins.findInstructions).toHaveBeenCalledWith(ctx, ["p1"]);
    const [{ messages }] = llm.stream.mock.calls[0].slice(1) as unknown as [{ messages: LLMMessage[] }];
    expect(messages.slice(1, 3).map((m) => m.parts)).toEqual([
      [{ type: "text", text: "be brief" }],
      [{ type: "text", text: '<plugin name="Wiki &quot;docs&quot;">\nsearch first\n</plugin>' }],
    ]);
  });

  it("tells the model the owner's name, when known, before the system prompt", async () => {
    const { runner, llm } = setup([answer]);
    await runner.run(userCtx("Maria"), agent, run);

    const [{ messages }] = llm.stream.mock.calls[0].slice(1) as unknown as [{ messages: LLMMessage[] }];
    expect(messages.slice(0, 3).map((m) => m.parts)).toEqual([
      [{ type: "text", text: "Your name is Suporte Técnico" }],
      [{ type: "text", text: "The user's name is Maria" }],
      [{ type: "text", text: "be brief" }],
    ]);
  });

  it("fires the run's hooks with the payload as it was at the time", async () => {
    const { runner, events } = setup([callTool, answer]);
    await runner.run(ctx, agent, run);

    expect(events.map((e) => `${e.run.turn} ${e.hook}`)).toEqual([
      "0 run.start",
      "0 run.context",
      "1 llm.request",
      "1 llm.response",
      "1 tool.before",
      "1 tool.after",
      "2 llm.request",
      "2 llm.response",
      "2 run.end",
    ]);
    const payload = (hook: string, n = 0) => events.filter((e) => e.hook === hook)[n].payload;
    expect(payload("run.start")).toEqual({ input: "hi" });
    expect(payload("run.context")).toMatchObject({ input: "hi", tools: [{ name: "ask_question" }] });
    // Each request holds the messages as they were sent, not the final history.
    expect((payload("llm.request", 0) as { messages: unknown[] }).messages).toHaveLength(3);
    expect((payload("llm.request", 1) as { messages: unknown[] }).messages).toHaveLength(5);
    expect(payload("tool.before")).toMatchObject({ tool: { id: "p1", name: "Wiki" } });
    expect(payload("tool.after")).toMatchObject({ call: { name: "ask_question" }, result: { content: "answer" } });
    expect(payload("run.end")).toMatchObject({
      status: AgentRunStatus.COMPLETED,
      error: null,
      rawError: null,
      input: "hi",
      output: (answer.parts[0] as { text: string }).text,
      turns: 2,
    });
    // The user's message, then each reply and tool result.
    expect((payload("run.end") as { messages: unknown[] }).messages).toHaveLength(4);
    expect(events.at(-1)).toMatchObject({ run: { id: "r1", sessionId: "s1", status: AgentRunStatus.COMPLETED } });
  });

  it("runs a tool call as a hook changed it, answering the call the model made", async () => {
    const { runner, plugins, saved } = setup([callTool, answer], (e) =>
      e.hook === "tool.before"
        ? { action: "modify", payload: { call: { ...e.payload.call, arguments: { q: "y" } } } }
        : { action: "continue" },
    );
    await runner.run(ctx, agent, run);

    expect(plugins.executeTool).toHaveBeenCalledWith(ctx, "p1", expect.objectContaining({ name: "ask_question" }), {
      q: "y",
    });
    expect(saved[1].parts).toMatchObject([{ toolCallId: "c1", content: "answer" }]);
  });

  it("gives a denied tool call the reason as an error result and tool.error, without running it", async () => {
    const { runner, plugins, saved, events } = setup([callTool, answer], (e) =>
      e.hook === "tool.before" ? { action: "deny", reason: "not now" } : { action: "continue" },
    );
    await runner.run(ctx, agent, run);

    expect(plugins.executeTool).not.toHaveBeenCalled();
    expect(saved[1].parts).toEqual([{ type: "tool_result", toolCallId: "c1", content: "not now", isError: true }]);
    expect(events.find((e) => e.hook === "tool.error")?.payload).toMatchObject({ reason: "denied" });
  });

  it("gives the model a rejected call's validation details as an error result", async () => {
    const { runner, plugins, saved, events } = setup([callTool, answer]);
    const response = { message: "validation failed", details: [{ path: ["q"] }] };
    plugins.executeTool.mockRejectedValue(new BadRequestException(response));
    await runner.run(ctx, agent, run);

    expect(events.find((e) => e.hook === "tool.error")?.payload).toMatchObject({ reason: "error_result" });
    expect(saved[1].parts).toEqual([
      { type: "tool_result", toolCallId: "c1", content: JSON.stringify(response), isError: true },
    ]);
  });

  it("uses an llm.request respond as the reply, without calling the LLM", async () => {
    const { runner, runs, llm, saved } = setup([], (e) =>
      e.hook === "llm.request" ? { action: "respond", result: answer } : { action: "continue" },
    );
    await runner.run(ctx, agent, run);

    expect(llm.stream).not.toHaveBeenCalled();
    expect(saved).toEqual([answer]);
    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.COMPLETED, turns: 1 });
  });

  it("fails the run with the reason when a hook stops a tool call", async () => {
    const { runner, runs, plugins } = setup([callTool, answer], (e) =>
      e.hook === "tool.before" ? { action: "stop", reason: "forbidden" } : { action: "continue" },
    );
    await runner.run(ctx, agent, run);

    expect(plugins.executeTool).not.toHaveBeenCalled();
    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.FAILED, error: "forbidden" });
  });

  it("fails the run with the reason when a hook stops its start", async () => {
    const { runner, runs, llm } = setup([answer], (e) =>
      e.hook === "run.start" ? { action: "stop", reason: "off topic" } : { action: "continue" },
    );
    await runner.run(ctx, agent, run);

    expect(llm.stream).not.toHaveBeenCalled();
    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.FAILED, error: "off topic" });
  });

  it("sees the current run and the historyRuns before it, with the tool results of the older ones omitted", async () => {
    const { runner, runs, messages, llm } = setup([answer]);
    runs.find.mockResolvedValue([{ id: "r1" }, { id: "r0" }, { id: "rOld" }]);
    const result = (toolCallId: string) => ({ type: "tool_result", toolCallId, content: "data", isError: false });
    messages.find.mockResolvedValue([
      { runId: "rOld", role: "assistant", parts: [{ ...callTool.parts[0], id: "old" }] },
      { runId: "rOld", role: "tool", parts: [result("old")] },
      { runId: "r0", role: "assistant", parts: [{ ...callTool.parts[0], id: "prev" }] },
      { runId: "r0", role: "tool", parts: [result("prev")] },
      { runId: "r1", role: "user", parts: [{ type: "text", text: "hi" }] },
    ]);
    await runner.run(ctx, { ...agent, historyRuns: 2 } as Agent, run);

    expect(runs.find).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionId: "s1" }, take: 3 }));
    const [{ messages: sent }] = llm.stream.mock.calls[0].slice(1) as unknown as [{ messages: LLMMessage[] }];
    const contents = sent.flatMap((m) => m.parts.flatMap((p) => (p.type === "tool_result" ? [p.content] : [])));
    expect(contents).toEqual(["[result omitted]", "data"]);
  });

  it("stops at maxTurns while the model keeps calling tools", async () => {
    const { runner, runs } = setup([callTool, callTool]);
    await runner.run(ctx, { ...agent, maxTurns: 2 } as Agent, run);

    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.MAX_TURNS, turns: 2 });
  });

  it("fails with a client-safe message on llm errors", async () => {
    const { runner, runs } = setup([
      llmProviderError(LLMErrorCode.UNAVAILABLE, new Error("connect ECONNREFUSED 10.0.0.1")),
    ]);
    await runner.run(ctx, agent, run);

    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.FAILED, error: "llm provider unavailable" });
  });

  it("gives run.end the raw error the client never sees", async () => {
    const { runner, events } = setup([
      llmProviderError(LLMErrorCode.UNAVAILABLE, new Error("connect ECONNREFUSED 10.0.0.1")),
    ]);
    await runner.run(ctx, agent, run);

    expect(events.find((e) => e.hook === "run.end")?.payload).toMatchObject({
      status: AgentRunStatus.FAILED,
      rawError: { message: "llm provider unavailable", cause: { message: "connect ECONNREFUSED 10.0.0.1" } },
    });
  });
});
