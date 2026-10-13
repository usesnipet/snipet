import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService, maskSecrets, restoreSecrets, validateJson } from "@snipet/server-common";
import { DeepPartial, In, QueryDeepPartialEntity, Repository } from "typeorm";

import { ActionResult } from "../../infra/plugin/driver.js";
import { DriverRegistry } from "../../infra/plugin/driver.registry.js";
import { PluginValidationError } from "../../infra/plugin/errors.js";
import { PluginRegistry, secretFields } from "../../infra/plugin/plugin.registry.js";
import { resolveOptions } from "../../infra/plugin/resolve.js";

import { PluginAction } from "./plugin-action.entity.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";

import type { PluginManifest } from "@snipet/shared";
// Config is validated against the plugin manifest before saving; a
// connection that validates but can't be reached is still saved, with the
// error in lastSyncedError.
@Injectable()
export class PluginConnectionService extends CrudService<PluginConnection> {
  constructor(
    @InjectRepository(PluginConnection) repo: Repository<PluginConnection>,
    @InjectRepository(PluginAction) private readonly actions: Repository<PluginAction>,
    private readonly plugins: PluginRegistry,
    private readonly drivers: DriverRegistry,
    private readonly syncer: PluginConnectionSyncService,
  ) {
    super(repo);
  }

  override async create(dto: DeepPartial<PluginConnection>): Promise<PluginConnection> {
    const config = this.validatePluginConnection(dto.pluginKey!, dto.config ?? {});
    const { id } = await super.create({ ...dto, config });
    void this.syncer.sync(id);
    return this.findById(id);
  }

  // Secret placeholders keep the stored values, but only for the same
  // plugin: another plugin must not receive this one's credentials.
  override async updateById(id: string, dto: QueryDeepPartialEntity<PluginConnection>): Promise<void> {
    const existing = await this.findById(id);
    const pluginKey = (dto.pluginKey as string | undefined) ?? existing.pluginKey;
    const changed = dto.pluginKey !== undefined || dto.config !== undefined;
    if (changed) {
      const incoming = (dto.config as Record<string, unknown> | undefined) ?? existing.config;
      const config = restoreSecrets(incoming, pluginKey === existing.pluginKey ? existing.config : undefined);
      dto = { ...dto, config: this.validatePluginConnection(pluginKey, config) as QueryDeepPartialEntity<object> };
    }
    await super.updateById(id, dto);
    if (changed) void this.syncer.sync(id);
  }

  sync(id: string): Promise<void> {
    return this.syncer.sync(id);
  }

  // Synced actions of the enabled connections among connectionIds.
  findActions(connectionIds: string[]): Promise<PluginAction[]> {
    if (!connectionIds.length) return Promise.resolve([]);
    return this.actions.find({
      where: { pluginConnectionId: In(connectionIds), pluginConnection: { enabled: true } },
      order: { name: "ASC" },
    });
  }

  // Failures the model can act on (bad arguments, unreachable service) come
  // back as an isError result.
  async executeAction(actionId: string, args: Record<string, unknown> = {}): Promise<ActionResult> {
    const action = await this.actions.findOneByOrFail({ id: actionId });
    const conn = await this.findById(action.pluginConnectionId);
    const manifest = this.plugins.get(conn.pluginKey);
    if (!conn.enabled || !manifest.actions) return { content: "plugin connection is unavailable", isError: true };

    try {
      args = validateJson(action.inputSchema, args);
    } catch (err) {
      return { content: `invalid arguments: ${describe(err)}`, isError: true };
    }
    try {
      const driver = this.drivers.getActionDriver(manifest.actions.driver);
      const options = resolveOptions(driver, manifest.actions, conn.config);
      return await driver.callAction(conn.id, action.name, args, options);
    } catch (err) {
      return { content: describe(err), isError: true };
    }
  }

  listManifests(): PluginManifest[] {
    return this.plugins.getAll();
  }

  getManifest(key: string): PluginManifest {
    return this.plugins.get(key);
  }

  // Secret fields come back as placeholders.
  mask(conn: PluginConnection): PluginConnection {
    const secrets = Object.fromEntries(
      secretFields(this.plugins.get(conn.pluginKey))
        .filter((k) => k in conn.config)
        .map((k) => [k, conn.config[k]]),
    );
    return { ...conn, config: { ...conn.config, ...maskSecrets(secrets) } };
  }

  // Checks the config against the manifest's `connection` schema, then each
  // capability's options against its driver. Returns the config with schema
  // defaults applied.
  validatePluginConnection(pluginKey: string, config: Record<string, unknown>): Record<string, unknown> {
    const manifest = this.plugins.get(pluginKey);
    let connection: Record<string, unknown>;
    try {
      connection = validateJson(manifest.connection, config);
    } catch (err) {
      if (err instanceof BadRequestException) throw new PluginValidationError(err.getResponse());
      throw err;
    }
    if (manifest.actions)
      resolveOptions(this.drivers.getActionDriver(manifest.actions.driver), manifest.actions, connection);
    if (manifest.healthCheck) {
      resolveOptions(this.drivers.getHealthCheckDriver(manifest.healthCheck.driver), manifest.healthCheck, connection);
    }
    return connection;
  }
}

function describe(err: unknown): string {
  if (err instanceof BadRequestException) return JSON.stringify(err.getResponse());
  return err instanceof Error ? err.message : String(err);
}
