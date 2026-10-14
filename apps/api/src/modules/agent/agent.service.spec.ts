import { jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";

import type { Storage } from "#src/infra/storage/storage.js";

import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

import type { Repository } from "typeorm";

function setup(exists = true, avatar: string | null = null) {
  const repoMock = () => ({
    findOne: jest.fn(() => Promise.resolve(exists ? { id: "a1", avatar } : null)),
    update: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    save: jest.fn(),
  });
  const repos = new Map<unknown, ReturnType<typeof repoMock>>([
    [Agent, repoMock()],
    [AgentLlm, repoMock()],
    [AgentPluginConnection, repoMock()],
  ]);
  const m = { getRepository: (target: unknown) => repos.get(target) };
  const repo = { manager: { transaction: (fn: (em: unknown) => Promise<void>) => fn(m) } };
  const storage = {
    putDataUrl: jest.fn(() => Promise.resolve("agents/new.webp")),
    delete: jest.fn(() => Promise.resolve()),
  };
  const service = new AgentService(repo as unknown as Repository<Agent>, storage as unknown as Storage);
  return {
    service,
    storage,
    agents: repos.get(Agent)!,
    llms: repos.get(AgentLlm)!,
    pluginGrants: repos.get(AgentPluginConnection)!,
  };
}

describe("AgentService.updateById", () => {
  it("replaces llms in list order and leaves missing lists alone", async () => {
    const { service, agents, llms, pluginGrants } = setup();
    await service.updateById("a1", { name: "x", llms: [{ model: "openai/a" }, { model: "ollama/b" }] });

    expect(agents.update).toHaveBeenCalledWith("a1", { name: "x" });
    expect(llms.delete).toHaveBeenCalledWith({ agentId: "a1" });
    expect(llms.save).toHaveBeenCalledWith([
      { model: "openai/a", order: 0, agentId: "a1" },
      { model: "ollama/b", order: 1, agentId: "a1" },
    ]);
    expect(pluginGrants.delete).not.toHaveBeenCalled();
  });

  it("replaces plugin connections when sent", async () => {
    const { service, pluginGrants } = setup();
    const grant = { pluginConnectionId: "p1", allow: ["read_*"], deny: [] };
    await service.updateById("a1", { pluginConnections: [grant] });

    expect(pluginGrants.delete).toHaveBeenCalledWith({ agentId: "a1" });
    expect(pluginGrants.insert).toHaveBeenCalledWith([{ ...grant, agentId: "a1" }]);
  });

  it("404s an unknown agent", async () => {
    const { service } = setup(false);
    await expect(service.updateById("a1", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("uploads a new avatar and deletes the previous file", async () => {
    const { service, agents, storage } = setup(true, "http://localhost:8852/api/files/agents/old.webp");
    await service.updateById("a1", { avatar: "data:image/webp;base64,AAAA" });

    expect(storage.putDataUrl).toHaveBeenCalledWith("agents", "data:image/webp;base64,AAAA");
    expect(agents.update).toHaveBeenCalledWith("a1", { avatar: "agents/new.webp" });
    expect(storage.delete).toHaveBeenCalledWith("agents/old.webp");
  });

  it("leaves the avatar alone when its current URL is sent back", async () => {
    const { service, agents, storage } = setup(true, "agents/old.webp");
    await service.updateById("a1", { name: "x", avatar: "http://localhost:8852/api/files/agents/old.webp" });

    expect(agents.update).toHaveBeenCalledWith("a1", { name: "x" });
    expect(storage.putDataUrl).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("deletes the uploaded file when the agent does not exist", async () => {
    const { service, storage } = setup(false);
    await expect(service.updateById("a1", { avatar: "data:image/webp;base64,AAAA" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.delete).toHaveBeenCalledWith("agents/new.webp");
  });
});
