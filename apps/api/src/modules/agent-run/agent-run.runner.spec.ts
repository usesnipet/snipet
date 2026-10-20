import { LlmError } from "#src/llm/errors.js";
import { jest } from "@jest/globals";
import { AgentRunStatus } from "@snipet/shared";

import { Debugger } from "../debug/debugger.js";

import { AgentRunEvents } from "./agent-run.events.js";
import { AgentRunner } from "./agent-run.runner.js";
import { AgentContext } from "./agent-context.js";

import type { Agent } from "../agent/agent.entity.js";
import type { DebugService } from "../debug/debug.service.js";
import type { LlmConnectionService } from "../llm-connection/llm-connection.service.js";
import type { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";
import type { AgentRun } from "./agent-run.entity.js";
import type { LlmMessage, LlmStreamEvent } from "@snipet/shared";
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
  llms: [{ model: "openai/gpt", connectionId: null, extraOptions: null }],
  pluginConnections: [{ pluginConnectionId: "p1", allow: ["ask_*"], deny: [] }],
} as unknown as Agent;
const run = { id: "r1", sessionId: "s1", createdAt: new Date("2026-10-16T14:32:05Z"), debugged: true } as AgentRun;

const wiki = { pluginConnectionId: "p1", pluginConnection: { name: "Wiki" } };

/** replies: what the model answers on each turn; an Error is thrown instead. */
function setup(replies: (LlmMessage | Error)[]) {
  let nextId = 1;
  const saved: LlmMessage[] = [];
  const messages = {
    find: jest.fn<Fn>().mockResolvedValue([{ role: "user", parts: [{ type: "text", text: "hi" }] }]),
    create: (m: unknown) => m,
    save: jest.fn((m: LlmMessage) => {
      saved.push({ role: m.role, parts: m.parts });
      return Promise.resolve({ ...m, id: nextId++ });
    }),
  };
  const runs = { update: jest.fn<Fn>(), findOneByOrFail: jest.fn<Fn>().mockResolvedValue(run) };
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

  // The debug files written, by path.
  const debugFiles = new Map<string, unknown>();
  const debugs = {
    debug: async (dir: string, enabled: boolean, fn: (d: Debugger) => Promise<void>) => {
      const d = new Debugger(
        enabled
          ? (file, json) => Promise.resolve(void debugFiles.set(`${dir}/${file}`, JSON.parse(json) as unknown))
          : undefined,
      );
      await fn(d);
      await d.save();
    },
  };

  const runner = new AgentRunner(
    runs as unknown as Repository<AgentRun>,
    messages as unknown as Repository<never>,
    llm as unknown as LlmConnectionService,
    new AgentRunEvents(),
    new AgentContext(plugins as unknown as PluginConnectionService),
    debugs as unknown as DebugService,
  );
  return { runner, runs, llm, plugins, saved, debugFiles };
}

const finishedWith = (runs: { update: jest.Mock<Fn> }) => runs.update.mock.calls[0][1];

describe("AgentRunner.run", () => {
  it("runs the granted plugin actions the model calls and feeds the results back", async () => {
    const { runner, runs, llm, plugins, saved } = setup([callTool, answer]);
    await runner.run(agent, run);

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
    await runner.run(agent, run);

    expect(plugins.findInstructions).toHaveBeenCalledWith(["p1"]);
    const [{ messages }] = llm.stream.mock.calls[0] as unknown as [{ messages: LlmMessage[] }];
    expect(messages.slice(1, 3).map((m) => m.parts)).toEqual([
      [{ type: "text", text: "be brief" }],
      [{ type: "text", text: '<plugin name="Wiki &quot;docs&quot;">\nsearch first\n</plugin>' }],
    ]);
  });

  it("records the run in its debug files", async () => {
    const { runner, debugFiles } = setup([callTool, answer]);
    await runner.run(agent, run);

    const dir = "2026-10-16/suporte-tecnico_ag1/s1/14-32-05_r1/";
    const file = (name: string) => debugFiles.get(dir + name);
    expect([...debugFiles.keys()].map((path) => path.slice(dir.length)).sort()).toEqual([
      "agent.json",
      "outcome.json",
      "toolCalls/0001.json",
      "tools.json",
      "turns/0001.json",
      "turns/0002.json",
    ]);
    expect(file("tools.json")).toMatchObject({
      available: [{ name: "ask_question" }],
      denied: [{ action: "read_wiki", pluginConnectionId: "p1" }],
    });
    const turns = ["turns/0001.json", "turns/0002.json"].map(
      (name) => file(name) as { turn: number; messages: LlmMessage[]; reply: LlmMessage },
    );
    // Each turn holds the messages as they were sent, not the final history.
    expect(turns.map((t) => [t.turn, t.messages.length])).toEqual([
      [1, 3],
      [2, 5],
    ]);
    expect(turns[1].reply).toEqual(answer);
    expect(file("toolCalls/0001.json")).toMatchObject({
      turn: 1,
      name: "ask_question",
      known: true,
      result: { content: "answer" },
    });
    expect(file("outcome.json")).toEqual({ status: AgentRunStatus.COMPLETED, error: null, turns: 2 });
  });

  it("stops at maxTurns while the model keeps calling tools", async () => {
    const { runner, runs } = setup([callTool, callTool]);
    await runner.run({ ...agent, maxTurns: 2 } as Agent, run);

    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.MAX_TURNS, turns: 2 });
  });

  it("fails with a client-safe message on llm errors", async () => {
    const { runner, runs } = setup([new LlmError("unavailable", "connect ECONNREFUSED 10.0.0.1")]);
    await runner.run(agent, run);

    expect(finishedWith(runs)).toMatchObject({ status: AgentRunStatus.FAILED, error: "llm provider unavailable" });
  });

  it("keeps the raw error, hidden from the client, in the debug files", async () => {
    const { runner, debugFiles } = setup([new LlmError("unavailable", "connect ECONNREFUSED 10.0.0.1")]);
    await runner.run(agent, run);

    const dir = "2026-10-16/suporte-tecnico_ag1/s1/14-32-05_r1/";
    expect(debugFiles.get(`${dir}error.json`)).toMatchObject({ message: "connect ECONNREFUSED 10.0.0.1" });
    expect(debugFiles.get(`${dir}outcome.json`)).toMatchObject({ status: AgentRunStatus.FAILED });
  });
});
