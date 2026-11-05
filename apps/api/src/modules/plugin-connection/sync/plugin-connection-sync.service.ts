import { ConnectionSyncService } from "#src/manifest/connection-sync.service.js";
import { PluginDriverRegistry, PluginRegistry } from "#src/plugin/plugin.registry.js";
import { uniqueSortedBy } from "#src/utils/sort/index.js";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MAX_PLUGIN_INSTRUCTIONS } from "@snipet/shared";
import { Repository } from "typeorm";

import { PluginConnection } from "../plugin-connection.entity.js";

import type { PluginDrivers } from "#src/plugin/driver.js";
import type { PluginManifest } from "@snipet/shared";

/** Keeps each connection's tools and instructions in line with its drivers. */
@Injectable()
export class PluginConnectionSyncService extends ConnectionSyncService<
  PluginConnection,
  PluginManifest,
  PluginDrivers
> {
  protected readonly keyField = "pluginKey";

  constructor(
    @InjectRepository(PluginConnection) connections: Repository<PluginConnection>,
    plugins: PluginRegistry,
    drivers: PluginDriverRegistry,
  ) {
    super(connections, plugins, drivers);
  }

  protected async fields(conn: PluginConnection, manifest: PluginManifest) {
    const lister = this.drivers.resolve(manifest, "tools", conn.config);
    const tools = lister && (await lister.driver.listTools(conn.id, lister.options));
    const resolved = this.drivers.resolve(manifest, "instructions", conn.config);
    const instructions = resolved && (await resolved.driver.getInstructions(conn.id, resolved.options));
    if (instructions && instructions.length > MAX_PLUGIN_INSTRUCTIONS)
      this.logger.warn(`Instructions for ${conn.id} are too long`);
    // Last, so a driver that throws above leaves the grants and stored tools in step.
    if (tools)
      await this.pruneGrants(
        conn.id,
        tools.map((t) => t.name),
      );
    return {
      // No tools capability: the stored ones are kept.
      ...(tools && { tools: uniqueSortedBy(tools, (t) => t.name) }),
      instructions: instructions?.slice(0, MAX_PLUGIN_INSTRUCTIONS) || null,
    };
  }

  /**
   * Drops removed tools from the agents' selections, so a later tool reusing
   * the name stays off until selected. Raw SQL because the agent module depends
   * on this one, not the other way around.
   */
  private async pruneGrants(connectionId: string, names: string[]): Promise<void> {
    await this.connections.query(
      `UPDATE "agent_plugin_connections"
       SET "tools" = ARRAY(SELECT t FROM unnest("tools") AS t WHERE t = ANY($2::text[]))
       WHERE "pluginConnectionId" = $1 AND NOT "tools" <@ $2::text[]`,
      [connectionId, names],
    );
  }
}
