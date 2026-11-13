import { TargetResolver } from "./target.resolver.js";

import type { Agent } from "@snipet/shared";
import type { CoreContext } from "../../context.js";
import type { LLMConnectionStore, RunLLMConnection } from "../../store/llm-connection.store.js";

const ctx = {} as CoreContext;
const connections: RunLLMConnection[] = [{ id: "c1", llmKey: "openai", config: { apiKey: "k" }, models: ["gpt"] }];
const store: LLMConnectionStore = {
  findByIds: (_ctx, ids) =>
    Promise.resolve(new Map(connections.filter((c) => ids.includes(c.id)).map((c) => [c.id, c]))),
};

describe("TargetResolver", () => {
  it("resolves the agent's models in order, a missing connection or model becoming an error target", async () => {
    const agent = {
      llms: [
        { connectionId: "c1", model: "gone", order: 2 },
        { connectionId: "c1", model: "gpt", order: 0 },
        { connectionId: "c9", model: "gpt", order: 1 },
      ],
    } as Agent;
    await expect(new TargetResolver(store).resolve(ctx, agent)).resolves.toEqual([
      { status: "success", model: "gpt", llm: "openai", connection: { apiKey: "k" } },
      { status: "error", model: "gpt", error: 'connection "c9" not found' },
      { status: "error", model: "gone", error: 'model "gone" not found' },
    ]);
  });
});
