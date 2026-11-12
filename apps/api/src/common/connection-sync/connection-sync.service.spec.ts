import { AppContext } from "#src/common/context/app-context.js";
import { Driver } from "#src/core/manifest/driver.js";
import { DriverRegistry } from "#src/core/manifest/driver.registry.js";
import { uniqueSortedBy } from "#src/utils/sort/index.js";
import { jest } from "@jest/globals";
import { pluginManifestSchema } from "@snipet/shared/core";
import type { PluginManifest } from "@snipet/shared/core";
import { z } from "zod";

import { ConnectionSyncService } from "./connection-sync.service.js";

import type { EntityManager } from "typeorm";
import type { SyncedConnectionEntity } from "./connection-sync.service.js";
import type { HealthCheckDriver, HealthCheckResult } from "#src/core/manifest/health-check.js";
import type { ManifestRegistry } from "#src/core/manifest/manifest.registry.js";

type Fn = (...args: unknown[]) => Promise<unknown>;

const anyDate = expect.any(Date) as unknown;

class Health extends Driver(z.object({ ok: z.boolean() })) implements HealthCheckDriver<{ ok: boolean }> {
  readonly key = "health";
  checkHealth({ ok }: { ok: boolean }): Promise<HealthCheckResult> {
    return Promise.resolve(ok ? { isHealthy: true } : { isHealthy: false, error: "down" });
  }
}
class Lister extends Driver(z.object({})) {
  readonly key = "lister";
}
type Drivers = { tools: Lister; healthCheck: Health };

type Conn = SyncedConnectionEntity & { pluginKey: string };

class TestSync extends ConnectionSyncService<Conn, PluginManifest, Drivers> {
  protected readonly keyField = "pluginKey";
  listed: Partial<Conn> | Error = {};

  protected fields() {
    if (this.listed instanceof Error) return Promise.reject(this.listed);
    return Promise.resolve(this.listed);
  }
}

const ctx = AppContext.create("test");

function setup({ healthy = true, withHealth = true } = {}) {
  const conn = { id: "c1", name: "conn", pluginKey: "alpha", config: {} } as Conn;
  const connections = {
    findOneBy: jest.fn<Fn>().mockResolvedValue(conn),
    find: jest.fn<Fn>().mockResolvedValue([{ id: "c1" }, { id: "c2" }]),
    update: jest.fn<Fn>(),
  };
  const manifest = pluginManifestSchema.parse({
    key: "alpha",
    name: "Alpha",
    capabilities: {
      tools: { driver: "lister" },
      ...(withHealth && { healthCheck: { driver: "health", options: { ok: healthy } } }),
    },
  });
  const service = new TestSync(
    { getRepository: () => connections } as unknown as EntityManager,
    "Conn",
    { get: () => manifest } as unknown as ManifestRegistry<PluginManifest, Drivers>,
    new DriverRegistry<Drivers>({ tools: [new Lister()], healthCheck: [new Health()] }),
  );
  return { service, connections };
}

describe("ConnectionSyncService.sync", () => {
  it("stores the listed fields with the sync's outcome", async () => {
    const { service, connections } = setup();
    service.listed = { name: "renamed" };
    await service.sync(ctx, "c1");
    expect(connections.update).toHaveBeenCalledTimes(1);
    expect(connections.update).toHaveBeenCalledWith("c1", {
      name: "renamed",
      lastSyncedAt: anyDate,
      lastSyncedError: null,
    });
  });

  it("records a failed health check and keeps the stored fields", async () => {
    const { service, connections } = setup({ healthy: false });
    service.listed = { name: "renamed" };
    await service.sync(ctx, "c1");
    expect(connections.update).toHaveBeenCalledWith("c1", {
      lastSyncedAt: anyDate,
      lastSyncedError: "health check failed: down",
    });
  });

  it("records a listing error, cut to 255 characters", async () => {
    const { service, connections } = setup({ withHealth: false });
    service.listed = new Error("x".repeat(300));
    await expect(service.sync(ctx, "c1")).resolves.toBeUndefined();
    expect(connections.update).toHaveBeenCalledWith("c1", {
      lastSyncedAt: anyDate,
      lastSyncedError: "x".repeat(255),
    });
  });

  it("skips a deleted connection", async () => {
    const { service, connections } = setup();
    connections.findOneBy.mockResolvedValue(null);
    await service.sync(ctx, "c1");
    expect(connections.update).not.toHaveBeenCalled();
  });
});

describe("ConnectionSyncService.syncAll", () => {
  it("syncs every connection", async () => {
    const { service, connections } = setup();
    await service.syncAll(ctx);
    expect(connections.findOneBy).toHaveBeenCalledWith({ id: "c1" });
    expect(connections.findOneBy).toHaveBeenCalledWith({ id: "c2" });
  });
});

describe("uniqueSortedBy", () => {
  it("sorts by key, the last of a duplicate winning", () => {
    const items = [
      { name: "b", v: 1 },
      { name: "a", v: 1 },
      { name: "b", v: 2 },
    ];
    expect(uniqueSortedBy(items, (i) => i.name)).toEqual([
      { name: "a", v: 1 },
      { name: "b", v: 2 },
    ]);
  });
});
