import type { Agent } from "@snipet/shared";
import type { LLMTarget } from "@snipet/shared/core";
import type { CoreContext } from "../../context.js";
import type { LLMConnectionStore } from "../../store/llm-connection.store.js";

/**
 * The agent's models as LLM targets, in its order. A model whose connection
 * or model is gone becomes a target with an error, which the LLM runner
 * skips, rather than failing the run.
 */
export class TargetResolver {
  constructor(private readonly llmConnectionStore: LLMConnectionStore) {}

  async resolve(ctx: CoreContext, agent: Agent): Promise<LLMTarget[]> {
    const llms = agent.llms.toSorted((a, b) => a.order - b.order);
    const connections = await this.llmConnectionStore.findByIds(
      ctx,
      llms.map((llm) => llm.connectionId),
    );
    return llms.map(({ connectionId, model }): LLMTarget => {
      const connection = connections.get(connectionId);
      if (!connection) return { status: "error", model, error: `connection "${connectionId}" not found` };
      if (!connection.models.includes(model)) return { status: "error", model, error: `model "${model}" not found` };
      return { status: "success", model, llm: connection.llmKey, connection: connection.config };
    });
  }
}
