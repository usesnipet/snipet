import { AppContext } from "#src/common/context/app-context.js";
import { CoreError } from "#src/core/error.js";
import { LLMErrorCode } from "#src/core/llm/errors.js";
import { jest } from "@jest/globals";

import { LlmConnectionService } from "./llm-connection.service.js";

import type { EntityManager } from "typeorm";
import type { LlmConnection } from "./llm-connection.entity.js";

const model = (key: string) => ({ key, name: key, description: "", capabilities: [], contextWindow: 0 });

const byId: Record<string, Partial<LlmConnection>> = {
  c1: { id: "c1", llmKey: "openai", config: { apiKey: "sk-1" }, models: [model("gpt-4o")] },
  c2: { id: "c2", llmKey: "openai", config: { apiKey: "sk-2" }, models: [model("meta/llama")] },
  c3: { id: "c3", llmKey: "ollama", config: {}, models: [] },
};

const ctx = AppContext.create("test");

function setup() {
  const repo = {
    findOne: jest.fn(({ where }: { where: { id: string; llmKey: string } }) => {
      const conn = byId[where.id];
      return Promise.resolve(conn?.llmKey === where.llmKey ? conn : null);
    }),
    metadata: { name: "LlmConnection" },
  };
  // Only the repository is used by these methods.
  const service = new LlmConnectionService(
    { getRepository: () => repo } as unknown as EntityManager,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service };
}

describe("LlmConnectionService.resolveTargets", () => {
  it("resolves each target to its connection's config", async () => {
    const { service } = setup();
    await expect(
      service.resolveTargets(ctx, [
        { llm: "openai", model: "gpt-4o", connectionId: "c1" },
        { llm: "openai", model: "meta/llama", connectionId: "c2" },
      ]),
    ).resolves.toEqual([
      { llm: "openai", model: "gpt-4o", connection: { apiKey: "sk-1" } },
      { llm: "openai", model: "meta/llama", connection: { apiKey: "sk-2" } },
    ]);
  });

  it("marks a target unusable instead of throwing, so the runner skips it", async () => {
    const { service } = setup();
    const [missing, otherLlm, unsynced] = await service.resolveTargets(ctx, [
      { llm: "openai", model: "gpt-4o", connectionId: "gone" },
      { llm: "openai", model: "gpt-4o", connectionId: "c3" },
      { llm: "openai", model: "gpt-5", connectionId: "c1" },
    ]);
    expect(missing).toMatchObject({ error: { code: LLMErrorCode.CONNECTION_NOT_FOUND } });
    expect(otherLlm).toMatchObject({ error: { code: LLMErrorCode.CONNECTION_NOT_FOUND } });
    expect(unsynced).toMatchObject({
      error: { code: LLMErrorCode.MODEL_NOT_FOUND, message: 'model "openai/gpt-5" not found' },
    });
  });
});

describe("LlmConnectionService.listLLMModels", () => {
  it("reads the connection's models from the database", async () => {
    const { service } = setup();
    await expect(service.listLLMModels(ctx, "openai", "c2")).resolves.toEqual([model("meta/llama")]);
  });

  it("rejects a connection of another llm", async () => {
    const { service } = setup();
    await expect(service.listLLMModels(ctx, "openai", "c3")).rejects.toThrow(CoreError);
  });
});
