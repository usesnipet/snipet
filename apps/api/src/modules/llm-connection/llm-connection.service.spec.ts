import { jest } from "@jest/globals";
import { SECRET_PLACEHOLDER } from "@snipet/server-common";

import { LlmConnectionService } from "./llm-connection.service.js";

import type { LlmRegistry } from "../../infra/llm/registry.js";
import type { LlmRunner } from "../../infra/llm/runner.js";
import type { LlmConnection } from "./llm-connection.entity.js";
import type { Repository } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;

const stored = { id: "c1", provider: "openai", config: { auth: { apiKey: "sk-123" }, config: {} } };

function setup() {
  const repo = {
    findOneBy: jest.fn<Fn>().mockResolvedValue(stored),
    update: jest.fn<Fn>(),
    existsBy: jest.fn<Fn>().mockResolvedValue(true),
    metadata: { name: "LlmConnection" },
    manager: { transaction: (cb: (m: unknown) => Promise<unknown>) => cb({ getRepository: () => repo }) },
  };
  const connect = jest.fn<Fn>();
  const service = new LlmConnectionService(
    repo as unknown as Repository<LlmConnection>,
    { connect } as unknown as LlmRegistry,
    {} as LlmRunner,
  );
  return { service, repo, connect };
}

describe("LlmConnectionService.updateById", () => {
  it("keeps the stored auth for placeholders", async () => {
    const { service, repo } = setup();
    await service.updateById("c1", { config: { auth: { apiKey: SECRET_PLACEHOLDER }, config: { x: 1 } } });
    expect(repo.update).toHaveBeenCalledWith("c1", { config: { auth: { apiKey: "sk-123" }, config: { x: 1 } } });
  });

  it("never hands the stored auth to another provider", async () => {
    const { service, connect } = setup();
    await service.updateById("c1", { provider: "groq", config: { auth: { apiKey: SECRET_PLACEHOLDER } } });
    expect(connect).toHaveBeenCalledWith("groq", { auth: {} });
  });
});
