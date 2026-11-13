import { LLMMessagePartType, LLMRole } from "@snipet/shared/core";

import { HistoryResolver } from "./history.resolver.js";

import type { Agent, AgentMessage, AgentRun } from "@snipet/shared";
import type { LLMMessagePart } from "@snipet/shared/core";
import type { CoreContext } from "../../context.js";
import type { MessageStore } from "../../store/message.store.js";

const ctx = {} as CoreContext;
let nextId = 1;

/** A stored message of run `runId`. */
const message = (runId: string, role: LLMRole, ...parts: LLMMessagePart[]): AgentMessage => ({
  id: nextId++,
  sessionId: "s1",
  runId,
  role,
  parts,
  model: null,
  createdAt: new Date(),
});
const text = (value: string) => ({ type: LLMMessagePartType.TEXT as const, text: value });
const toolCall = (id: string) => ({ type: LLMMessagePartType.TOOL_CALL as const, id, name: "t", arguments: {} });
const toolResult = (toolCallId: string, content: string) => ({
  type: LLMMessagePartType.TOOL_RESULT as const,
  toolCallId,
  content,
});

/** A resolver over `messages`, recording what it was asked for. */
function resolverOf(messages: AgentMessage[], asked: unknown[] = []) {
  const store = {
    listRecent: (_ctx: CoreContext, sessionId: string, runs: number) => {
      asked.push({ sessionId, runs });
      return Promise.resolve(messages);
    },
  } as MessageStore;
  return new HistoryResolver(store);
}

const agent = { historyRuns: 2 } as Agent;
const run = { id: "r3", sessionId: "s1" } as AgentRun;

describe("HistoryResolver", () => {
  it("asks for the current run and the agent's historyRuns before it", async () => {
    const asked: unknown[] = [];
    await resolverOf([], asked).resolve(ctx, { agent, run });
    expect(asked).toEqual([{ sessionId: "s1", runs: 3 }]);
  });

  it("omits tool results older than the last two runs and drops unpaired calls and results", async () => {
    const history = await resolverOf([
      message("r1", LLMRole.USER, text("first")),
      message("r1", LLMRole.ASSISTANT, toolCall("old")),
      message("r1", LLMRole.TOOL, toolResult("old", "big result")),
      message("r2", LLMRole.ASSISTANT, text("checking"), toolCall("crashed")),
      message("r2", LLMRole.TOOL, toolResult("orphan", "lost")),
      message("r3", LLMRole.ASSISTANT, toolCall("new")),
      message("r3", LLMRole.TOOL, toolResult("new", "fresh")),
    ]).resolve(ctx, { agent, run });

    expect(history).toEqual([
      { role: LLMRole.USER, parts: [text("first")] },
      { role: LLMRole.ASSISTANT, parts: [toolCall("old")] },
      { role: LLMRole.TOOL, parts: [toolResult("old", "[result omitted]")] },
      { role: LLMRole.ASSISTANT, parts: [text("checking")] },
      { role: LLMRole.ASSISTANT, parts: [toolCall("new")] },
      { role: LLMRole.TOOL, parts: [toolResult("new", "fresh")] },
    ]);
  });
});
