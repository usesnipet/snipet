import { Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { BaseEntity } from "@snipet/server-common";
import type { BaseManifest } from "@snipet/shared";
import type { DeepPartial, EntityTarget, FindOptionsWhere, Repository } from "typeorm";
import type { ConnectionEntity } from "./connection.service.js";
import type { DriverRegistry, DriverTypes } from "./driver.registry.js";
import type { HealthCheckDriver } from "./health-check.js";
import type { ManifestRegistry } from "./manifest.registry.js";

const MAX_ERROR_LENGTH = 255;

export type SyncedConnectionEntity = ConnectionEntity & {
  name: string;
  lastSyncedAt: Date | null;
  lastSyncedError: string | null;
};

// Keeps a connection's items (plugin actions, llm models) in line with what
// its driver lists: health check first, then the items are replaced, matched
// by `itemKeyField`. Runs on boot, every hour and on demand.
// - keyField: the connection column naming the manifest, e.g. "pluginKey"
// - connectionField: the item column pointing at the connection
// - itemKeyField: the item column that identifies it within a connection
export abstract class ConnectionSyncService<
  E extends SyncedConnectionEntity,
  M extends BaseManifest,
  D extends DriverTypes & { healthCheck: HealthCheckDriver },
  I extends BaseEntity,
> implements OnApplicationBootstrap {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly keyField: keyof E & string;
  protected abstract readonly connectionField: keyof I & string;
  protected abstract readonly itemKeyField: keyof I & string;

  constructor(
    protected readonly connections: Repository<E>,
    protected readonly manifests: ManifestRegistry<M, D>,
    protected readonly drivers: DriverRegistry<D>,
    private readonly itemTarget: EntityTarget<I>,
  ) {}

  // The connection's items as the driver lists them, or undefined when the
  // manifest doesn't have that capability (the stored items are kept).
  protected abstract list(conn: E, manifest: M): Promise<DeepPartial<I>[] | undefined>;

  onApplicationBootstrap() {
    void this.syncAll();
  }

  // Never throws: the error is recorded on the connection, and the previous
  // items are kept. Deleted connections are skipped.
  async sync(id: string): Promise<void> {
    const conn = await this.connections.findOneBy({ id } as FindOptionsWhere<E>);
    if (!conn) return;
    let lastSyncedError: string | null = null;
    try {
      await this.syncConnection(conn);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sync connection ${conn.name} (${conn[this.keyField] as string}) ${id}: ${message}`);
      lastSyncedError = message.slice(0, MAX_ERROR_LENGTH);
    }
    await this.connections.update(id, { lastSyncedAt: new Date(), lastSyncedError } as never);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncAll(): Promise<void> {
    for (const { id } of await this.connections.find({ select: { id: true } as never })) {
      await this.sync(id);
    }
  }

  private async syncConnection(conn: E): Promise<void> {
    const manifest = this.manifests.get(conn[this.keyField] as string);

    const health = this.drivers.resolve(manifest, "healthCheck", conn.config);
    if (health) {
      const result = await health.driver.checkHealth(conn.id, health.options);
      if (!result.isHealthy) throw new Error(`health check failed: ${result.error ?? "unknown error"}`);
    }

    const items = await this.list(conn, manifest);
    if (!items) return;

    await this.connections.manager.transaction(async (m) => {
      const repo = m.getRepository(this.itemTarget);
      const byConnection = { [this.connectionField]: conn.id } as FindOptionsWhere<I>;
      const stale = new Map((await repo.findBy(byConnection)).map((i) => [i[this.itemKeyField] as string, i.id]));
      for (const item of items) {
        const key = item[this.itemKeyField as keyof DeepPartial<I>] as string;
        const id = stale.get(key);
        stale.delete(key);
        await repo.save({ ...item, ...byConnection, ...(id && { id }) } as DeepPartial<I>);
      }
      if (stale.size) await repo.delete([...stale.values()]);
    });
  }
}
