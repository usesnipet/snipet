import { LLMMessagePartType } from "@snipet/shared/core";

import type { Agent, AgentRun } from "@snipet/shared";
import type { LLMMessage, LLMMessagePart } from "@snipet/shared/core";
import type { CoreContext } from "../../context.js";
import type { MessageStore } from "../../store/message.store.js";

/** The last runs, the current one included, whose tool results the models see in full. */
const FULL_TOOL_RUNS = 2;

/** Stands in for an older tool result, which is mostly tokens the models no longer need. */
const OMITTED_RESULT = "[result omitted]";

/** What the history is resolved for. */
type HistoryResolverOptions = {
  agent: Agent;
  run: AgentRun;
};

/**
 * The conversation the models see: the current run and the agent's
 * historyRuns before it, ending with the run's user message.
 */
export class HistoryResolver {
  constructor(private readonly messageStore: MessageStore) {}

  async resolve(ctx: CoreContext, { agent, run }: HistoryResolverOptions): Promise<LLMMessage[]> {
    const messages = await this.messageStore.listRecent(ctx, run.sessionId, agent.historyRuns + 1);
    const runIds = [...new Set(messages.map((m) => m.runId))];
    const fullToolRuns = new Set(runIds.slice(-FULL_TOOL_RUNS));
    // Providers reject calls without results and results without calls; a
    // crashed run can leave either.
    const all = messages.flatMap((m) => m.parts);
    const calls = new Set(all.flatMap((p) => (p.type === LLMMessagePartType.TOOL_CALL ? [p.id] : [])));
    const results = new Set(all.flatMap((p) => (p.type === LLMMessagePartType.TOOL_RESULT ? [p.toolCallId] : [])));
    /** Whether a part is paired to a tool call or result. */
    const paired = (p: LLMMessagePart) => {
      if (p.type === LLMMessagePartType.TOOL_CALL) return results.has(p.id);
      if (p.type === LLMMessagePartType.TOOL_RESULT) return calls.has(p.toolCallId);
      return true;
    };
    return messages
      .map(({ role, parts, runId }) => ({
        role,
        parts: parts.filter(paired).map((p) => {
          if (p.type === LLMMessagePartType.TOOL_RESULT && !fullToolRuns.has(runId)) {
            return { ...p, content: OMITTED_RESULT };
          }
          return p;
        }),
      }))
      .filter((m) => m.parts.length > 0);
  }
}
