import { ConnectionSyncService } from "#src/common/connection-sync/connection-sync.service.js";
import { PluginDriverRegistry, PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import { uniqueSortedBy } from "#src/utils/sort/index.js";
import { Injectable } from "@nestjs/common";
import { MAX_PLUGIN_INSTRUCTIONS } from "@snipet/shared";
import { EntityManager } from "typeorm";

import { PluginConnection } from "../plugin-connection.entity.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { PluginDrivers } from "#src/core/plugin/driver.js";
import type { PluginManifest } from "@snipet/shared";

/** Keeps each connection's tools and instructions in line with its drivers. */
@Injectable()
export class PluginConnectionSyncService extends ConnectionSyncService<
  PluginConnection,
  PluginManifest,
  PluginDrivers
> {
  protected readonly keyField = "pluginKey";

  constructor(manager: EntityManager, plugins: PluginManifestRegistry, drivers: PluginDriverRegistry) {
    super(manager, PluginConnection, plugins, drivers);
  }

  protected async fields(ctx: AppContext, conn: PluginConnection, manifest: PluginManifest) {
    const lister = this.drivers.resolve(manifest, "tools", conn.config);
    const tools = lister && (await lister.driver.listTools(conn.id, lister.options));
    const resolved = this.drivers.resolve(manifest, "instructions", conn.config);
    const instructions = resolved && (await resolved.driver.getInstructions(conn.id, resolved.options));
    if (instructions && instructions.length > MAX_PLUGIN_INSTRUCTIONS)
      this.logger.warn(`Instructions for ${conn.id} are too long`);
    // Last, so a driver that throws above leaves the grants and stored tools in step.
    if (tools)
      await this.pruneGrants(
        ctx,
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
  private async pruneGrants(ctx: AppContext, connectionId: string, names: string[]): Promise<void> {
    await this.repository(ctx).query(
      `UPDATE "agent_plugin_connections"
       SET "tools" = ARRAY(SELECT t FROM unnest("tools") AS t WHERE t = ANY($2::text[]))
       WHERE "pluginConnectionId" = $1 AND NOT "tools" <@ $2::text[]`,
      [connectionId, names],
    );
  }
}
