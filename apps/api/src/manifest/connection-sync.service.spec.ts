import { jest } from "@jest/globals";
import { pluginManifestSchema } from "@snipet/shared";
import { z } from "zod";

import { ConnectionSyncService } from "./connection-sync.service.js";
import { Driver } from "./driver.js";
import { DriverRegistry } from "./driver.registry.js";

import type { BaseEntity } from "@snipet/server-common";
import type { PluginManifest } from "@snipet/shared";
import type { Repository } from "typeorm";
import type { SyncedConnectionEntity } from "./connection-sync.service.js";
import type { HealthCheckDriver, HealthCheckResult } from "./health-check.js";
import type { ManifestRegistry } from "./manifest.registry.js";

type Fn = (...args: unknown[]) => Promise<unknown>;

const anyDate = expect.any(Date) as unknown;

class Health extends Driver(z.object({ ok: z.boolean() })) implements HealthCheckDriver<{ ok: boolean }> {
  readonly key = "health";
  checkHealth(_id: string, { ok }: { ok: boolean }): Promise<HealthCheckResult> {
    return Promise.resolve(ok ? { isHealthy: true } : { isHealthy: false, error: "down" });
  }
}
class Lister extends Driver(z.object({})) {
  readonly key = "lister";
}
type Drivers = { actions: Lister; healthCheck: Health };

type Conn = SyncedConnectionEntity & { pluginKey: string };
type Item = BaseEntity & { connId: string; name: string; v: number };

class TestSync extends ConnectionSyncService<Conn, PluginManifest, Drivers, Item> {
  protected readonly keyField = "pluginKey";
  protected readonly connectionField = "connId";
  protected readonly itemKeyField = "name";
  listed: { name: string; v: number }[] | undefined | Error = [];

  protected list() {
    if (this.listed instanceof Error) return Promise.reject(this.listed);
    return Promise.resolve(this.listed);
  }
}

function setup({ healthy = true, withHealth = true } = {}) {
  const conn = { id: "c1", name: "conn", pluginKey: "alpha", config: {} } as Conn;
  const items = {
    findBy: jest.fn<Fn>().mockResolvedValue([
      { id: "i1", name: "keep", v: 1 },
      { id: "i2", name: "gone", v: 1 },
    ]),
    save: jest.fn<Fn>(),
    delete: jest.fn<Fn>(),
  };
  const connections = {
    findOneBy: jest.fn<Fn>().mockResolvedValue(conn),
    find: jest.fn<Fn>().mockResolvedValue([{ id: "c1" }, { id: "c2" }]),
    update: jest.fn<Fn>(),
    manager: { transaction: (cb: (m: unknown) => Promise<unknown>) => cb({ getRepository: () => items }) },
  };
  const manifest = pluginManifestSchema.parse({
    key: "alpha",
    name: "Alpha",
    actions: { driver: "lister" },
    ...(withHealth && { healthCheck: { driver: "health", options: { ok: healthy } } }),
  });
  const service = new TestSync(
    connections as unknown as Repository<Conn>,
    { get: () => manifest } as unknown as ManifestRegistry<PluginManifest, Drivers>,
    new DriverRegistry<Drivers>({ actions: [new Lister()], healthCheck: [new Health()] }),
    "items",
  );
  return { service, connections, items };
}

describe("ConnectionSyncService.sync", () => {
  it("upserts the listed items by key and deletes the stale ones", async () => {
    const { service, connections, items } = setup();
    service.listed = [
      { name: "keep", v: 2 },
      { name: "new", v: 1 },
    ];
    await service.sync("c1");
    expect(items.findBy).toHaveBeenCalledWith({ connId: "c1" });
    expect(items.save).toHaveBeenCalledWith({ name: "keep", v: 2, connId: "c1", id: "i1" });
    expect(items.save).toHaveBeenCalledWith({ name: "new", v: 1, connId: "c1" });
    expect(items.delete).toHaveBeenCalledWith(["i2"]);
    expect(connections.update).toHaveBeenCalledWith("c1", { lastSyncedAt: anyDate, lastSyncedError: null });
  });

  it("records a failed health check and keeps the items", async () => {
    const { service, connections, items } = setup({ healthy: false });
    await service.sync("c1");
    expect(items.save).not.toHaveBeenCalled();
    expect(items.delete).not.toHaveBeenCalled();
    expect(connections.update).toHaveBeenCalledWith("c1", {
      lastSyncedAt: anyDate,
      lastSyncedError: "health check failed: down",
    });
  });

  it("records a listing error, cut to 255 characters", async () => {
    const { service, connections } = setup({ withHealth: false });
    service.listed = new Error("x".repeat(300));
    await expect(service.sync("c1")).resolves.toBeUndefined();
    expect(connections.update).toHaveBeenCalledWith("c1", {
      lastSyncedAt: anyDate,
      lastSyncedError: "x".repeat(255),
    });
  });

  it("keeps the items when the manifest lacks the capability", async () => {
    const { service, items } = setup();
    service.listed = undefined;
    await service.sync("c1");
    expect(items.findBy).not.toHaveBeenCalled();
  });

  it("skips a deleted connection", async () => {
    const { service, connections } = setup();
    connections.findOneBy.mockResolvedValue(null);
    await service.sync("c1");
    expect(connections.update).not.toHaveBeenCalled();
  });
});

describe("ConnectionSyncService.syncAll", () => {
  it("syncs every connection", async () => {
    const { service, connections } = setup();
    await service.syncAll();
    expect(connections.findOneBy).toHaveBeenCalledWith({ id: "c1" });
    expect(connections.findOneBy).toHaveBeenCalledWith({ id: "c2" });
  });
});
