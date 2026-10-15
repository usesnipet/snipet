import { jest } from "@jest/globals";
import { AgentRunStatus } from "@snipet/shared";

import { LlmError } from "#src/llm/errors.js";

import { AgentRunEvents } from "./agent-run.events.js";
import { AgentRunner } from "./agent-run.runner.js";

import type { Agent } from "../agent/agent.entity.js";
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
  systemPrompt: "be brief",
  maxTurns: 5,
  llms: [{ model: "openai/gpt", connectionId: null, extraOptions: null }],
  pluginConnections: [{ pluginConnectionId: "p1", allow: ["ask_*"], deny: [] }],
} as unknown as Agent;
const run = { id: "r1", sessionId: "s1" } as AgentRun;

// replies: what the model answers on each turn; an Error is thrown instead.
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
      { id: "a1", name: "ask_question", description: "", inputSchema: {}, pluginConnectionId: "p1" },
      { id: "a2", name: "read_wiki", description: "", inputSchema: {}, pluginConnectionId: "p1" },
    ]),
    executeAction: jest.fn<Fn>().mockResolvedValue({ content: "answer", isError: false }),
  };

  const runner = new AgentRunner(
    runs as unknown as Repository<AgentRun>,
    messages as unknown as Repository<never>,
    llm as unknown as LlmConnectionService,
    new AgentRunEvents(),
    plugins as unknown as PluginConnectionService,
  );
  return { runner, runs, llm, plugins, saved };
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
      { messages: LlmMessage[]; tools: { name: string }[] },
    ];
    expect(messages.map((m) => m.role)).toEqual(["system", "system", "user", "assistant", "tool"]);
    // read_wiki isn't in the plugin grant's allow.
    expect(tools.map((t) => t.name)).toEqual(["ask_question"]);
    expect(plugins.findActions).toHaveBeenCalledWith(["p1"]);
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
});
