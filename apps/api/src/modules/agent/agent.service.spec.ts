import { jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";

import { Agent, AgentLlm, AgentMcpServer, AgentPluginConnection } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

import type { Repository } from "typeorm";

function setup(exists = true) {
  const repoMock = () => ({
    existsBy: jest.fn(() => Promise.resolve(exists)),
    update: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    save: jest.fn(),
  });
  const repos = new Map<unknown, ReturnType<typeof repoMock>>([
    [Agent, repoMock()],
    [AgentLlm, repoMock()],
    [AgentMcpServer, repoMock()],
    [AgentPluginConnection, repoMock()],
  ]);
  const m = { getRepository: (target: unknown) => repos.get(target) };
  const repo = { manager: { transaction: (fn: (em: unknown) => Promise<void>) => fn(m) } };
  const service = new AgentService(repo as unknown as Repository<Agent>);
  return {
    service,
    agents: repos.get(Agent)!,
    llms: repos.get(AgentLlm)!,
    grants: repos.get(AgentMcpServer)!,
    pluginGrants: repos.get(AgentPluginConnection)!,
  };
}

describe("AgentService.updateById", () => {
  it("replaces llms in list order and leaves missing lists alone", async () => {
    const { service, agents, llms, grants } = setup();
    await service.updateById("a1", { name: "x", llms: [{ model: "openai/a" }, { model: "ollama/b" }] });

    expect(agents.update).toHaveBeenCalledWith("a1", { name: "x" });
    expect(llms.delete).toHaveBeenCalledWith({ agentId: "a1" });
    expect(llms.save).toHaveBeenCalledWith([
      { model: "openai/a", order: 0, agentId: "a1" },
      { model: "ollama/b", order: 1, agentId: "a1" },
    ]);
    expect(grants.delete).not.toHaveBeenCalled();
  });

  it("replaces plugin connections when sent", async () => {
    const { service, grants, pluginGrants } = setup();
    const grant = { pluginConnectionId: "p1", allow: ["read_*"], deny: [] };
    await service.updateById("a1", { pluginConnections: [grant] });

    expect(pluginGrants.delete).toHaveBeenCalledWith({ agentId: "a1" });
    expect(pluginGrants.insert).toHaveBeenCalledWith([{ ...grant, agentId: "a1" }]);
    expect(grants.delete).not.toHaveBeenCalled();
  });

  it("clears mcp servers with an empty list", async () => {
    const { service, agents, grants } = setup();
    await service.updateById("a1", { mcpServers: [] });

    expect(agents.update).not.toHaveBeenCalled();
    expect(grants.delete).toHaveBeenCalledWith({ agentId: "a1" });
    expect(grants.insert).toHaveBeenCalledWith([]);
  });

  it("404s an unknown agent", async () => {
    const { service } = setup(false);
    await expect(service.updateById("a1", {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
