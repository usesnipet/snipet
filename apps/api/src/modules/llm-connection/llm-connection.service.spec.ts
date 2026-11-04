import { jest } from "@jest/globals";

import { LlmError } from "#src/llm/errors.js";

import type { LLMRunner } from "#src/llm/llm.runner.js";
import { LlmConnectionService } from "./llm-connection.service.js";

import type { LLMDriverRegistry, LLMRegistry } from "#src/llm/llm.registry.js";
import type { Repository } from "typeorm";
import type { LlmConnection } from "./llm-connection.entity.js";
import type { LlmConnectionSyncService } from "./sync/llm-connection-sync.service.js";

const model = (key: string) => ({ key, name: key, description: "", capabilities: [], contextWindow: 0 });

const byId: Record<string, Partial<LlmConnection>> = {
  c1: { id: "c1", llmKey: "openai", config: { apiKey: "sk-1" }, models: [model("gpt-4o")] },
  c2: { id: "c2", llmKey: "openai", config: { apiKey: "sk-2" }, default: true, models: [model("meta/llama")] },
  c3: { id: "c3", llmKey: "ollama", config: {} },
};

function setup() {
  const repo = {
    findOneBy: jest.fn((where: Partial<LlmConnection>) =>
      Promise.resolve(
        where.id ? byId[where.id] : Object.values(byId).find((c) => c.llmKey === where.llmKey && c.default),
      ),
    ),
    findOne: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(byId[where.id] ?? null)),
    metadata: { name: "LlmConnection" },
  };
  const service = new LlmConnectionService(
    repo as unknown as Repository<LlmConnection>,
    {} as LLMRegistry,
    {} as LLMDriverRegistry,
    {} as LlmConnectionSyncService,
    {} as LLMRunner,
  );
  return { service };
}

describe("LlmConnectionService.resolveTargets", () => {
  it("uses the named connection, else the llm's default", async () => {
    const { service } = setup();
    await expect(
      service.resolveTargets([
        { model: "openai/gpt-4o", connectionId: "c1", extraOptions: { temperature: 0 } },
        { model: "openai/meta/llama" },
      ]),
    ).resolves.toEqual([
      { model: "openai/gpt-4o", connection: { apiKey: "sk-1" }, extraOptions: { temperature: 0 } },
      { model: "openai/meta/llama", connection: { apiKey: "sk-2" }, extraOptions: undefined },
    ]);
  });

  it("checks the model against the connection's synced models", async () => {
    const { service } = setup();
    await expect(service.resolveTargets([{ model: "openai/gpt-5", connectionId: "c1" }])).rejects.toThrow(
      'model "openai/gpt-5" not found',
    );
  });

  it("rejects a connection of another llm", async () => {
    const { service } = setup();
    await expect(service.resolveTargets([{ model: "openai/gpt-4o", connectionId: "c3" }])).rejects.toThrow(
      'connection "c3" is not a "openai" connection',
    );
  });

  it("rejects an llm without a default connection", async () => {
    const { service } = setup();
    await expect(service.resolveTargets([{ model: "ollama/llama3" }])).rejects.toThrow(LlmError);
  });
});

describe("LlmConnectionService.listLLMModels", () => {
  it("reads the default connection's models from the database", async () => {
    const { service } = setup();
    await expect(service.listLLMModels("openai")).resolves.toEqual([model("meta/llama")]);
  });
});
