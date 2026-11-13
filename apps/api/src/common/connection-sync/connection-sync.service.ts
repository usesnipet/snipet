import { AppContext } from "#src/common/context/app-context.js";
import { Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { BaseManifest } from "@snipet/shared";
import type { EntityManager, EntityTarget, FindOptionsWhere, Repository } from "typeorm";
import type { ConnectionEntity } from "./connection.service.js";
import type { DriverRegistry, DriverTypes } from "#src/core/manifest/driver.registry.js";
import type { HealthCheckDriver } from "#src/core/manifest/health-check.js";
import type { ManifestRegistry } from "#src/core/manifest/manifest.registry.js";

const MAX_ERROR_LENGTH = 255;

export type SyncedConnectionEntity = ConnectionEntity & {
  name: string;
  lastSyncedAt: Date | null;
  lastSyncedError: string | null;
};

/**
 * Keeps what a connection stores from its drivers (plugin tools, llm models)
 * in line with them: health check first, then the fields are replaced at once.
 * Runs on boot, every hour and on demand.
 * - keyField: the connection column naming the manifest, e.g. "pluginKey"
 */
export abstract class ConnectionSyncService<
  E extends SyncedConnectionEntity,
  M extends BaseManifest,
  D extends DriverTypes & { healthCheck: HealthCheckDriver },
> implements OnApplicationBootstrap {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly keyField: keyof E & string;

  constructor(
    private readonly manager: EntityManager,
    private readonly target: EntityTarget<E>,
    protected readonly manifests: ManifestRegistry<M, D>,
    protected readonly drivers: DriverRegistry<D>,
  ) {}

  /** The connections table, joining the context's transaction when there is one. */
  protected repository(ctx: AppContext): Repository<E> {
    return (ctx.tx ?? this.manager).getRepository(this.target);
  }

  /** The connection's fields as its drivers list them; one left out keeps its stored value. */
  protected abstract fields(ctx: AppContext, conn: E, manifest: M): Promise<Partial<E>>;

  onApplicationBootstrap() {
    void this.syncAll(AppContext.create(`bootstrap:${this.constructor.name}`));
  }

  /**
   * Health-checks one connection and refreshes its fields. Never throws: the
   * error is recorded on the connection and the stored fields are kept.
   * Deleted connections are skipped.
   */
  async sync(ctx: AppContext, id: string): Promise<void> {
    const conn = await this.repository(ctx).findOneBy({ id } as FindOptionsWhere<E>);
    if (!conn) return;
    let fields: Partial<E> = {};
    let lastSyncedError: string | null = null;
    try {
      fields = await this.syncConnection(ctx, conn);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sync connection ${conn.name} (${conn[this.keyField] as string}) ${id}: ${message}`);
      lastSyncedError = message.slice(0, MAX_ERROR_LENGTH);
    }
    await this.repository(ctx).update(id, { ...fields, lastSyncedAt: new Date(), lastSyncedError } as never);
  }

  /** Called with no context by the cron, which has no request: a root one is made. */
  @Cron(CronExpression.EVERY_HOUR)
  async syncAll(ctx = AppContext.create(`cron:${this.constructor.name}`)): Promise<void> {
    for (const { id } of await this.repository(ctx).find({ select: { id: true } as never })) {
      await this.sync(ctx, id);
    }
  }

  private async syncConnection(ctx: AppContext, conn: E): Promise<Partial<E>> {
    const manifest = this.manifests.get(conn[this.keyField] as string);

    const health = this.drivers.resolve(manifest, "healthCheck", conn.config);
    if (health) {
      const result = await health.driver.checkHealth(health.options);
      if (!result.isHealthy) throw new Error(`health check failed: ${result.error ?? "unknown error"}`);
    }

    return this.fields(ctx, conn, manifest);
  }
}
