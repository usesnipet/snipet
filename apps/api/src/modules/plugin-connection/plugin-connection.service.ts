import { ConnectionService } from "#src/common/connection-sync/connection.service.js";
import { PluginDrivers } from "#src/core/plugin/driver.js";
import { PluginDriverRegistry, PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import { Injectable, NotFoundException } from "@nestjs/common";
import { validateJson } from "@snipet/server-common";
import { DeepPartial, EntityManager, In, QueryDeepPartialEntity } from "typeorm";

import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { LLMTool, LLMToolResult, PluginManifest } from "@snipet/shared/core";

/** A synced tool with the connection it comes from. */
export type ConnectionTool = LLMTool & { connection: { id: string; name: string } };

/**
 * Service for managing plugin connections and executing tools.
 */
@Injectable()
export class PluginConnectionService extends ConnectionService<PluginConnection, PluginManifest, PluginDrivers> {
  protected readonly keyField = "pluginKey";

  constructor(
    manager: EntityManager,
    plugins: PluginManifestRegistry,
    drivers: PluginDriverRegistry,
    private readonly syncer: PluginConnectionSyncService,
  ) {
    super(manager, PluginConnection, plugins, drivers);
  }

  override async create(ctx: AppContext, dto: DeepPartial<PluginConnection>): Promise<PluginConnection> {
    const { id } = await super.create(ctx, dto);
    void this.sync(ctx, id);
    return this.findById(ctx, id);
  }

  override async updateById(ctx: AppContext, id: string, dto: QueryDeepPartialEntity<PluginConnection>): Promise<void> {
    await super.updateById(ctx, id, dto);
    if (dto.pluginKey !== undefined || dto.config !== undefined) void this.syncer.sync(ctx, id);
  }

  sync(ctx: AppContext, id: string): Promise<void> {
    return this.syncer.sync(ctx, id);
  }

  /**
   * The manifest of each existing connection among connectionIds; null when
   * its plugin is no longer in the catalog. Missing ids aren't in the map.
   */
  async manifestsOf(ctx: AppContext, connectionIds: string[]): Promise<Map<string, PluginManifest | null>> {
    if (!connectionIds.length) return new Map();
    // No config: it would be decrypted for nothing.
    const conns = await this.repository(ctx).find({
      select: { id: true, pluginKey: true },
      where: { id: In(connectionIds) },
    });
    const manifestOf = (key: string) => this.manifests.getAll().find((m) => m.key === key) ?? null;
    return new Map(conns.map((c) => [c.id, manifestOf(c.pluginKey)]));
  }

  /** The enabled connections among connectionIds, config unsealed, by id. */
  async findEnabled(ctx: AppContext, connectionIds: string[]): Promise<Map<string, PluginConnection>> {
    if (!connectionIds.length) return new Map();
    const conns = await this.repository(ctx).find({ where: { id: In(connectionIds), enabled: true } });
    return new Map(conns.map((c) => [c.id, c]));
  }

  /** A connection's synced tools, enabled or not, without their schemas. */
  async listTools(ctx: AppContext, id: string): Promise<LLMTool[]> {
    // No config: it would be decrypted for nothing.
    const conn = await this.repository(ctx).findOne({ select: { id: true, tools: true }, where: { id } });
    if (!conn) throw new NotFoundException(`Plugin connection ${id} not found`);
    return conn.tools;
  }

  /**
   * Synced tools of the enabled connections among connectionIds, by name then
   * connection id so prompts stay cacheable.
   */
  async findTools(ctx: AppContext, connectionIds: string[]): Promise<ConnectionTool[]> {
    if (!connectionIds.length) return [];
    const conns = await this.repository(ctx).find({
      // No config: it would be decrypted for nothing.
      select: { id: true, name: true, tools: true },
      where: { id: In(connectionIds), enabled: true },
      order: { id: "ASC" },
    });
    return conns
      .flatMap(({ id, name, tools }) => tools.map((tool) => ({ ...tool, connection: { id, name } })))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * The instructions of the enabled connections among connectionIds, the
   * user's custom ones over the driver's, ordered by id so prompts stay cacheable.
   */
  async findInstructions(ctx: AppContext, connectionIds: string[]): Promise<{ name: string; text: string }[]> {
    if (!connectionIds.length) return [];
    const conns = await this.repository(ctx).find({
      select: { id: true, name: true, instructions: true, customInstructions: true },
      where: { id: In(connectionIds), enabled: true },
      order: { id: "ASC" },
    });
    return conns.flatMap(({ name, customInstructions, instructions }) => {
      const text = customInstructions?.trim() || instructions;
      return text ? [{ name, text }] : [];
    });
  }

  /**
   * Runs a synced tool through its connection's driver. Throws on bad
   * arguments or an unreachable service; the caller turns that into a result.
   */
  async executeTool(
    ctx: AppContext,
    connectionId: string,
    tool: LLMTool,
    args: Record<string, unknown> = {},
  ): Promise<LLMToolResult> {
    const conn = await this.findById(ctx, connectionId);
    const manifest = this.manifests.get(conn.pluginKey);
    if (!conn.enabled || !manifest.capabilities.tools) {
      return { content: "plugin connection is unavailable", isError: true };
    }

    const { driver, options } = this.drivers.resolve(manifest, "tools", conn.config)!;
    return driver.callTool(tool.name, validateJson(tool.inputSchema, args), options);
  }
}
