import { ConnectionService } from "#src/manifest/connection.service.js";
import { PluginDrivers, Tool, ToolResult } from "#src/plugin/driver.js";
import { PluginDriverRegistry, PluginRegistry } from "#src/plugin/plugin.registry.js";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { validateJson } from "@snipet/server-common";
import { DeepPartial, In, QueryDeepPartialEntity, Repository } from "typeorm";

import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";

import type { PluginManifest } from "@snipet/shared";

/** A synced tool with the connection it comes from. */
export type ConnectionTool = Tool & { connection: { id: string; name: string } };

/**
 * Service for managing plugin connections and executing tools.
 */
@Injectable()
export class PluginConnectionService extends ConnectionService<PluginConnection, PluginManifest, PluginDrivers> {
  protected readonly keyField = "pluginKey";

  constructor(
    @InjectRepository(PluginConnection) repo: Repository<PluginConnection>,
    plugins: PluginRegistry,
    drivers: PluginDriverRegistry,
    private readonly syncer: PluginConnectionSyncService,
  ) {
    super(repo, plugins, drivers);
  }

  override async create(dto: DeepPartial<PluginConnection>): Promise<PluginConnection> {
    const { id } = await super.create(dto);
    void this.syncer.sync(id);
    return this.findById(id);
  }

  override async updateById(id: string, dto: QueryDeepPartialEntity<PluginConnection>): Promise<void> {
    await super.updateById(id, dto);
    if (dto.pluginKey !== undefined || dto.config !== undefined) void this.syncer.sync(id);
  }

  sync(id: string): Promise<void> {
    return this.syncer.sync(id);
  }

  /**
   * The manifest of each existing connection among connectionIds; null when
   * its plugin is no longer in the catalog. Missing ids aren't in the map.
   */
  async manifestsOf(connectionIds: string[]): Promise<Map<string, PluginManifest | null>> {
    if (!connectionIds.length) return new Map();
    // No config: it would be decrypted for nothing.
    const conns = await this.repo.find({ select: { id: true, pluginKey: true }, where: { id: In(connectionIds) } });
    const manifestOf = (key: string) => this.manifests.getAll().find((m) => m.key === key) ?? null;
    return new Map(conns.map((c) => [c.id, manifestOf(c.pluginKey)]));
  }

  /** The enabled connections among connectionIds, config unsealed, by id. */
  async findEnabled(connectionIds: string[]): Promise<Map<string, PluginConnection>> {
    if (!connectionIds.length) return new Map();
    const conns = await this.repo.find({ where: { id: In(connectionIds), enabled: true } });
    return new Map(conns.map((c) => [c.id, c]));
  }

  /**
   * Synced tools of the enabled connections among connectionIds, by name then
   * connection id so prompts stay cacheable.
   */
  async findTools(connectionIds: string[]): Promise<ConnectionTool[]> {
    if (!connectionIds.length) return [];
    const conns = await this.repo.find({
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
  async findInstructions(connectionIds: string[]): Promise<{ name: string; text: string }[]> {
    if (!connectionIds.length) return [];
    const conns = await this.repo.find({
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
  async executeTool(connectionId: string, tool: Tool, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const conn = await this.findById(connectionId);
    const manifest = this.manifests.get(conn.pluginKey);
    if (!conn.enabled || !manifest.capabilities.tools) {
      return { content: "plugin connection is unavailable", isError: true };
    }

    const { driver, options } = this.drivers.resolve(manifest, "tools", conn.config)!;
    return driver.callTool(conn.id, tool.name, validateJson(tool.inputSchema, args), options);
  }
}
