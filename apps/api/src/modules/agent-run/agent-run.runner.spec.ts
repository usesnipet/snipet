import { LlmError } from "#src/llm/errors.js";
import { jest } from "@jest/globals";
import { AgentRunStatus, hookNameSchema } from "@snipet/shared";

import { HookRunner } from "../hook-connection/hook.runner.js";

import { AgentRunEvents } from "./agent-run.events.js";
import { AgentRunner } from "./agent-run.runner.js";
import { AgentContext } from "./agent-context.js";

import type { Owner } from "#src/common/decorators/owner.decorator.js";
import type { Agent } from "../agent/agent.entity.js";
import type { HookDriver } from "#src/hook/driver.js";
import type { HookDispatcher } from "../hook-connection/hook.dispatcher.js";
import type { HookRunnerContext } from "../hook-connection/hook.runner.js";
import type { LlmConnectionService } from "../llm-connection/llm-connection.service.js";
import type { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";
import type { AgentRun } from "./agent-run.entity.js";
import type { HookEvent, HookResult, LlmMessage, LlmStreamEvent } from "@snipet/shared";
import type { Repository } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;

const callTool: LlmMessage = {
  role: "assistant",
  parts: [{ type: "tool_call", id: "c1", name: "ask_question", arguments: { q: "x" } }],
};
const answer: LlmMessage = { role: "assistant", parts: [{ type: "text", text: "done" }] };

const agent = {
  id: "ag1",
  name: "Suporte Técnico",
  systemPrompt: "be brief",
  maxTurns: 5,
  historyRuns: 10,
  llms: [{ model: "openai/gpt", connectionId: null, extraOptions: null }],
  pluginConnections: [{ pluginConnectionId: "p1", allow: ["ask_*"], deny: [] }],
} as unknown as Agent;
const run = { id: "r1", sessionId: "s1", createdAt: new Date("2026-10-16T14:32:05Z") } as AgentRun;

const owner: Owner = { userId: "u1", appId: null, externalUserId: null, name: null };

const wiki = { pluginConnectionId: "p1", pluginConnection: { name: "Wiki" } };

/**
 * replies: what the model answers on each turn; an Error is thrown instead.
 * reply: what the hooks answer to each event.
 */
function setup(
  replies: (LlmMessage | Error)[],
  reply: (event: HookEvent) => HookResult = () => ({ action: "continue" }),
) {
  let nextId = 1;
  const saved: LlmMessage[] = [];
  const messages = {
    find: jest.fn<Fn>().mockResolvedValue([{ runId: "r1", role: "user", parts: [{ type: "text", text: "hi" }] }]),
    create: (m: unknown) => m,
    save: jest.fn((m: LlmMessage) => {
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
    stream: jest.fn(async function* (): AsyncGenerator<LlmStreamEvent> {
      const reply = await Promise.resolve(replies.shift()!);
      if (reply instanceof Error) throw reply;
      yield { event: "llm_started", data: { llm: "openai/gpt" } };
      yield { event: "message", data: { message: reply } };
    }),
  };
  const plugins = {
    findActions: jest.fn<Fn>().mockResolvedValue([
      { id: "a1", name: "ask_question", description: "Asks", inputSchema: {}, ...wiki },
      { id: "a2", name: "read_wiki", description: "", inputSchema: {}, ...wiki },
    ]),
    executeAction: jest.fn<Fn>().mockResolvedValue({ content: "answer", isError: false }),
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
  const handlers = hookNameSchema.options.map((event) => ({
    name: "rec",
    event,
    global: false,
    stage: 0,
    match: null,
    async: false,
    onError: "continue" as const,
    driver,
    options: {},
    timeoutMs: 1000,
  }));
  const hooks = {
    forRun: (ctx: HookRunnerContext) => Promise.resolve(new HookRunner(handlers, ctx)),
  } as unknown as HookDispatcher;

  const runner = new AgentRunner(
    runs as unknown as Repository<AgentRun>,
    messages as unknown as Repository<never>,
    llm as unknown as LlmConnectionService,
    new AgentRunEvents(),
    new AgentContext(plugins as unknown as PluginConnectionService),
    hooks,
  );
  return { runner, runs, messages, llm, plugins, saved, events };
}

const finishedWith = (runs: { update: jest.Mock<Fn> }) => runs.update.mock.calls[0][1];

describe("AgentRunner.run", () => {
  it("runs the granted plugin actions the model calls and feeds the results back", async () => {
    const { runner, runs, llm, plugins, saved } = setup([callTool, answer]);
    await runner.run(agent, run, owner);

    expect(plugins.executeAction).toHaveBeenCalledWith("a1", { q: "x" });
    expect(saved.map((m) => m.role)).toEqual(["assistant", "tool", "assistant"]);
    expect(saved[1].parts).toEqual([{ type: "tool_result", toolCallId: "c1", content: "answer", isError: false }]);
    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.COMPLETED, turns: 2, error: null });

    const [{ messages, tools }] = llm.stream.mock.calls[1] as unknown as [
      { messages: LlmMessage[]; tools: { name: string; description: string }[] },
    ];
    expect(messages.map((m) => m.role)).toEqual(["system", "system", "user", "assistant", "tool"]);
    // read_wiki isn't in the plugin grant's allow.
    expect(tools.map((t) => [t.name, t.description])).toEqual([["ask_question", "[Wiki] Asks"]]);
    expect(plugins.findActions).toHaveBeenCalledWith(["p1"]);
  });

  it("adds the instructions of the plugins with granted actions after the system prompt", async () => {
    const { runner, llm, plugins } = setup([answer]);
    plugins.findInstructions.mockResolvedValue([{ name: 'Wiki "docs"', text: "search first" }]);
    await runner.run(agent, run, owner);

    expect(plugins.findInstructions).toHaveBeenCalledWith(["p1"]);
    const [{ messages }] = llm.stream.mock.calls[0] as unknown as [{ messages: LlmMessage[] }];
    expect(messages.slice(1, 3).map((m) => m.parts)).toEqual([
      [{ type: "text", text: "be brief" }],
      [{ type: "text", text: '<plugin name="Wiki &quot;docs&quot;">\nsearch first\n</plugin>' }],
    ]);
  });

  it("tells the model the owner's name, when known, before the system prompt", async () => {
    const { runner, llm } = setup([answer]);
    await runner.run(agent, run, { ...owner, name: "Maria" });

    const [{ messages }] = llm.stream.mock.calls[0] as unknown as [{ messages: LlmMessage[] }];
    expect(messages.slice(0, 3).map((m) => m.parts)).toEqual([
      [{ type: "text", text: "Your name is Suporte Técnico" }],
      [{ type: "text", text: "The user's name is Maria" }],
      [{ type: "text", text: "be brief" }],
    ]);
  });

  it("fires the run's hooks with the payload as it was at the time", async () => {
    const { runner, events } = setup([callTool, answer]);
    await runner.run(agent, run, owner);

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
      "2 run.completed",
    ]);
    const payload = (hook: string, n = 0) => events.filter((e) => e.hook === hook)[n].payload;
    expect(payload("run.start")).toEqual({ input: "hi" });
    expect(payload("run.context")).toMatchObject({ tools: [{ name: "ask_question" }] });
    // Each request holds the messages as they were sent, not the final history.
    expect((payload("llm.request", 0) as { messages: unknown[] }).messages).toHaveLength(3);
    expect((payload("llm.request", 1) as { messages: unknown[] }).messages).toHaveLength(5);
    expect(payload("tool.after")).toMatchObject({ call: { name: "ask_question" }, result: { content: "answer" } });
    expect(payload("run.end")).toMatchObject({ status: AgentRunStatus.COMPLETED, error: null, turns: 2 });
    expect(events.at(-1)).toMatchObject({ run: { id: "r1", sessionId: "s1", status: AgentRunStatus.COMPLETED } });
  });

  it("runs a tool call as a hook changed it, answering the call the model made", async () => {
    const { runner, plugins, saved } = setup([callTool, answer], (e) =>
      e.hook === "tool.before"
        ? { action: "modify", payload: { call: { ...e.payload.call, arguments: { q: "y" } } } }
        : { action: "continue" },
    );
    await runner.run(agent, run, owner);

    expect(plugins.executeAction).toHaveBeenCalledWith("a1", { q: "y" });
    expect(saved[1].parts).toMatchObject([{ toolCallId: "c1", content: "answer" }]);
  });

  it("gives a blocked tool call the reason as an error result, without running it", async () => {
    const { runner, plugins, saved } = setup([callTool, answer], (e) =>
      e.hook === "tool.before" ? { action: "block", reason: "not now" } : { action: "continue" },
    );
    await runner.run(agent, run, owner);

    expect(plugins.executeAction).not.toHaveBeenCalled();
    expect(saved[1].parts).toEqual([{ type: "tool_result", toolCallId: "c1", content: "not now", isError: true }]);
  });

  it("fails the run with the reason when a hook blocks its start", async () => {
    const { runner, runs, llm } = setup([answer], (e) =>
      e.hook === "run.start" ? { action: "block", reason: "off topic" } : { action: "continue" },
    );
    await runner.run(agent, run, owner);

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
    await runner.run({ ...agent, historyRuns: 2 } as Agent, run, owner);

    expect(runs.find).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionId: "s1" }, take: 3 }));
    const [{ messages: sent }] = llm.stream.mock.calls[0] as unknown as [{ messages: LlmMessage[] }];
    const contents = sent.flatMap((m) => m.parts.flatMap((p) => (p.type === "tool_result" ? [p.content] : [])));
    expect(contents).toEqual(["[result omitted]", "data"]);
  });

  it("stops at maxTurns while the model keeps calling tools", async () => {
    const { runner, runs } = setup([callTool, callTool]);
    await runner.run({ ...agent, maxTurns: 2 } as Agent, run, owner);

    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.MAX_TURNS, turns: 2 });
  });

  it("fails with a client-safe message on llm errors", async () => {
    const { runner, runs } = setup([new LlmError("unavailable", "connect ECONNREFUSED 10.0.0.1")]);
    await runner.run(agent, run, owner);

    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.FAILED, error: "llm provider unavailable" });
  });

  it("gives run.failed the raw error the client never sees", async () => {
    const { runner, events } = setup([new LlmError("unavailable", "connect ECONNREFUSED 10.0.0.1")]);
    await runner.run(agent, run, owner);

    expect(events.find((e) => e.hook === "run.failed")?.payload).toMatchObject({
      error: { message: "connect ECONNREFUSED 10.0.0.1" },
    });
  });
});
