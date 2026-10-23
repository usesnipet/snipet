import { ConnectionSyncService } from "#src/manifest/connection-sync.service.js";
import { PluginDriverRegistry, PluginRegistry } from "#src/plugin/plugin.registry.js";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MAX_PLUGIN_INSTRUCTIONS } from "@snipet/shared";
import { Repository } from "typeorm";

import { PluginAction } from "../plugin-action.entity.js";
import { PluginConnection } from "../plugin-connection.entity.js";

import type { PluginDrivers } from "#src/plugin/driver.js";
import type { PluginManifest } from "@snipet/shared";

/**
 * Keeps plugin_actions in line with what each connection's action driver
 * lists, and the connection's instructions with its instructions driver.
 */
@Injectable()
export class PluginConnectionSyncService extends ConnectionSyncService<
  PluginConnection,
  PluginManifest,
  PluginDrivers,
  PluginAction
> {
  protected readonly keyField = "pluginKey";
  protected readonly connectionField = "pluginConnectionId";
  protected readonly itemKeyField = "name";

  constructor(
    @InjectRepository(PluginConnection) connections: Repository<PluginConnection>,
    plugins: PluginRegistry,
    drivers: PluginDriverRegistry,
  ) {
    super(connections, plugins, drivers, PluginAction);
  }

  protected async list(conn: PluginConnection, manifest: PluginManifest) {
    const resolved = this.drivers.resolve(manifest, "actions", conn.config);
    return resolved && resolved.driver.listActions(conn.id, resolved.options);
  }

  protected override async fields(conn: PluginConnection, manifest: PluginManifest) {
    const resolved = this.drivers.resolve(manifest, "instructions", conn.config);
    const instructions = resolved && (await resolved.driver.getInstructions(conn.id, resolved.options));
    return { instructions: instructions?.slice(0, MAX_PLUGIN_INSTRUCTIONS) || null };
  }
}
