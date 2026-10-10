import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { DriverRegistry } from "../../../infra/plugin/driver.registry.js";
import { PluginRegistry } from "../../../infra/plugin/plugin.registry.js";
import { resolveOptions } from "../../../infra/plugin/resolve.js";
import { PluginAction } from "../plugin-action.entity.js";
import { PluginConnection } from "../plugin-connection.entity.js";

const MAX_ERROR_LENGTH = 255;

// Keeps plugin_actions in line with what each connection's action driver
// lists. Runs on create/update and on demand.
// ponytail: no periodic sync or per-connection lock yet; copy McpServerSyncService's loop when needed.
@Injectable()
export class PluginConnectionSyncService {
  private readonly logger = new Logger(PluginConnectionSyncService.name);

  constructor(
    @InjectRepository(PluginConnection) private readonly connections: Repository<PluginConnection>,
    private readonly plugins: PluginRegistry,
    private readonly drivers: DriverRegistry,
  ) {}

  // Never throws: the error is recorded on the connection, and the previous
  // actions are kept. Deleted connections are skipped.
  async sync(id: string): Promise<void> {
    const conn = await this.connections.findOneBy({ id });
    if (!conn) return;
    try {
      await this.syncConnection(conn);
      await this.connections.update(id, { lastSyncedAt: new Date(), lastSyncedError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sync plugin connection ${id}: ${message}`);
      await this.connections.update(id, {
        lastSyncedAt: new Date(),
        lastSyncedError: message.slice(0, MAX_ERROR_LENGTH),
      });
    }
  }

  private async syncConnection(conn: PluginConnection): Promise<void> {
    const manifest = this.plugins.get(conn.pluginKey);

    if (manifest.healthCheck) {
      const driver = this.drivers.getHealthCheckDriver(manifest.healthCheck.driver);
      const health = await driver.checkHealth(conn.id, resolveOptions(driver, manifest.healthCheck, conn.config));
      if (!health.isHealthy) throw new Error(`health check failed: ${health.error ?? "unknown error"}`);
    }

    if (!manifest.actions) return;
    const driver = this.drivers.getActionDriver(manifest.actions.driver);
    const actions = await driver.listActions(conn.id, resolveOptions(driver, manifest.actions, conn.config));

    // Replaces the connection's actions with the listed ones, matched by name.
    await this.connections.manager.transaction(async (m) => {
      const actionsRepo = m.getRepository(PluginAction);
      const stale = new Map((await actionsRepo.findBy({ pluginConnectionId: conn.id })).map((a) => [a.name, a.id]));
      for (const a of actions) {
        const existingId = stale.get(a.name);
        stale.delete(a.name);
        await actionsRepo.save(existingId ? { id: existingId, ...a } : { ...a, pluginConnectionId: conn.id });
      }
      if (stale.size) await actionsRepo.delete([...stale.values()]);
    });
  }
}
