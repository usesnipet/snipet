import { jest } from "@jest/globals";

import { AppContext } from "#src/common/context/app-context.js";

import { PluginConnectionSyncService } from "./plugin-connection-sync.service.js";

import type { PluginDriverRegistry, PluginRegistry } from "#src/plugin/plugin.registry.js";
import type { EntityManager } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;

/** A sync of one connection whose drivers behave as given; a null lister means no tools capability. */
const ctx = AppContext.create("test");

function setup(listTools: Fn | null, getInstructions: Fn = () => Promise.resolve(undefined)) {
  const connections = {
    findOneBy: jest.fn<Fn>().mockResolvedValue({ id: "c1", name: "conn", pluginKey: "k", config: {} }),
    update: jest.fn<Fn>(),
    query: jest.fn<Fn>(),
  };
  const drivers = {
    resolve: (_manifest: unknown, capability: string) => {
      if (capability === "tools") return listTools && { driver: { listTools }, options: {} };
      if (capability === "instructions") return { driver: { getInstructions }, options: {} };
      return null;
    },
  };
  const service = new PluginConnectionSyncService(
    { getRepository: () => connections } as unknown as EntityManager,
    { get: () => ({}) } as unknown as PluginRegistry,
    drivers as unknown as PluginDriverRegistry,
  );
  return { service, connections };
}

describe("PluginConnectionSyncService", () => {
  it("removes tools the driver no longer lists from the agents' selections", async () => {
    const { service, connections } = setup(() => Promise.resolve([{ name: "b" }, { name: "a" }]));
    await service.sync(ctx, "c1");
    expect(connections.query).toHaveBeenCalledWith(expect.any(String), ["c1", ["b", "a"]]);
  });

  it("keeps the selections when the tools can't be listed", async () => {
    const { service, connections } = setup(() => Promise.reject(new Error("down")));
    await service.sync(ctx, "c1");
    expect(connections.query).not.toHaveBeenCalled();
  });

  it("keeps the selections when a later driver fails, as the stored tools are kept too", async () => {
    const { service, connections } = setup(
      () => Promise.resolve([]),
      () => Promise.reject(new Error("down")),
    );
    await service.sync(ctx, "c1");
    expect(connections.query).not.toHaveBeenCalled();
  });

  it("keeps the selections of a plugin without a tools capability", async () => {
    const { service, connections } = setup(null);
    await service.sync(ctx, "c1");
    expect(connections.query).not.toHaveBeenCalled();
  });
});
