import { jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SECRET_PLACEHOLDER } from "@snipet/server-common";
import { pluginManifestSchema } from "@snipet/shared";

import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

import type { FilesStorage } from "../files/files.storage.js";
import type { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";

import type { Repository } from "typeorm";

/** A plugin with a secret setting, an optional hook and a required one. */
const memory = pluginManifestSchema.parse({
  key: "memory",
  name: "Memory",
  settings: {
    type: "object",
    properties: {
      scope: { type: "string", enum: ["user", "agent"], default: "user" },
      apiKey: { type: "string", secret: true },
    },
  },
  capabilities: {
    hooks: {
      driver: "memory",
      handlers: [
        { hook: "run.context", actions: ["modify"] },
        { hook: "run.end", background: true, optional: true },
      ],
    },
  },
});

function setup(exists = true, avatar: string | null = null) {
  const repoMock = () => ({
    find: jest.fn(() => Promise.resolve([] as unknown[])),
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
  const plugins = {
    // p1 is a memory connection, p2 one whose plugin left the catalog; anything else doesn't exist.
    manifestsOf: jest.fn((ids: string[]) =>
      Promise.resolve(
        new Map(ids.filter((id) => id === "p1" || id === "p2").map((id) => [id, id === "p1" ? memory : null])),
      ),
    ),
  };
  const service = new AgentService(
    repo as unknown as Repository<Agent>,
    storage as unknown as FilesStorage,
    plugins as unknown as PluginConnectionService,
  );
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

  it("replaces plugin connections when sent, in list order, settings checked against the manifest", async () => {
    const { service, pluginGrants } = setup();
    const grant = { pluginConnectionId: "p1", tools: ["read_wiki"], settings: {}, disabledHooks: [] };
    const gone = { pluginConnectionId: "p2", tools: [], settings: { x: 1 }, disabledHooks: [] };
    await service.updateById("a1", { pluginConnections: [grant, gone] });

    expect(pluginGrants.delete).toHaveBeenCalledWith({ agentId: "a1" });
    expect(pluginGrants.insert).toHaveBeenCalledWith([
      { ...grant, position: 0, settings: { scope: "user" }, agentId: "a1" },
      // Its plugin left the catalog: kept as sent.
      { ...gone, position: 1, agentId: "a1" },
    ]);
  });

  it("rejects settings that don't fit the manifest, and unknown connections", async () => {
    const { service } = setup();
    const grant = (pluginConnectionId: string, settings = {}) => ({
      pluginConnectionId,
      tools: [],
      settings,
      disabledHooks: [],
    });
    await expect(
      service.updateById("a1", { pluginConnections: [grant("p1", { scope: "team" })] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateById("a1", { pluginConnections: [grant("p9")] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("keeps stored secrets behind placeholders and only disables optional hooks", async () => {
    const { service, pluginGrants } = setup();
    pluginGrants.find.mockResolvedValue([{ pluginConnectionId: "p1", settings: { apiKey: "sk-1" } }]);
    await service.updateById("a1", {
      pluginConnections: [
        {
          pluginConnectionId: "p1",
          tools: [],
          settings: { apiKey: SECRET_PLACEHOLDER },
          disabledHooks: ["run.context", "run.end"],
        },
      ],
    });

    expect(pluginGrants.insert).toHaveBeenCalledWith([
      expect.objectContaining({ settings: { scope: "user", apiKey: "sk-1" }, disabledHooks: ["run.end"] }),
    ]);
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

describe("AgentService.mask", () => {
  it("hides secret settings, and every setting of a plugin gone from the catalog", async () => {
    const { service } = setup();
    const agent = {
      id: "a1",
      pluginConnections: [
        { pluginConnectionId: "p1", settings: { scope: "user", apiKey: "sk-1" } },
        { pluginConnectionId: "p2", settings: { token: "t" } },
      ],
    } as unknown as Agent;

    const masked = await service.mask(agent);
    expect(masked.pluginConnections.map((g) => g.settings)).toEqual([
      { scope: "user", apiKey: SECRET_PLACEHOLDER },
      { token: SECRET_PLACEHOLDER },
    ]);
  });

  describe("findSummaries", () => {
    it("takes the total from a count of agents, not from the joined rows", async () => {
      const find = jest.fn<(options: { select: object }) => Promise<unknown[]>>(() =>
        Promise.resolve([
          {
            id: "a1",
            name: "Helper",
            llms: [{ id: "l1", model: "x/first", order: 0 }],
            pluginConnections: [{ pluginConnectionId: "p1", pluginConnection: { name: "GitHub" } }],
          },
        ]),
      );
      const repo = { find, count: jest.fn(() => Promise.resolve(7)) } as unknown as Repository<Agent>;
      const service = new AgentService(repo, {} as FilesStorage, {} as PluginConnectionService);

      const page = await service.findSummaries({ take: 1, skip: 0 });

      expect(page.total).toBe(7);
      expect(find.mock.calls[0][0].select).not.toHaveProperty("systemPrompt");
      expect(page.data[0].llms).toEqual([{ model: "x/first" }]);
      expect(page.data[0].pluginConnections).toEqual([{ pluginConnectionId: "p1", name: "GitHub" }]);
    });
  });
});
