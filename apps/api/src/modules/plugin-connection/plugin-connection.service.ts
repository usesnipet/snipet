import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ConnectionService } from "#src/manifest/connection.service.js";
import { ToolResult, PluginDrivers } from "#src/plugin/driver.js";
import { PluginDriverRegistry, PluginRegistry } from "#src/plugin/plugin.registry.js";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { validateJson } from "@snipet/server-common";
import { DeepPartial, In, QueryDeepPartialEntity, Repository } from "typeorm";

import { PluginTool } from "./plugin-tool.entity.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";

import type { PluginManifest } from "@snipet/shared";

/**
 * Service for managing plugin connections and executing tools.
 */
@Injectable()
export class PluginConnectionService extends ConnectionService<PluginConnection, PluginManifest, PluginDrivers> {
  protected readonly keyField = "pluginKey";

  constructor(
    @InjectRepository(PluginConnection) repo: Repository<PluginConnection>,
    @InjectRepository(PluginTool) private readonly tools: Repository<PluginTool>,
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
   * Synced tools of the enabled connections among connectionIds, with the
   * connection's name.
   */
  findTools(connectionIds: string[]): Promise<PluginTool[]> {
    if (!connectionIds.length) return Promise.resolve([]);
    return this.tools.find({
      // No config: it would be decrypted once per tool.
      select: {
        id: true,
        name: true,
        description: true,
        inputSchema: true,
        pluginConnectionId: true,
        pluginConnection: { id: true, name: true },
      },
      relations: { pluginConnection: true },
      where: { pluginConnectionId: In(connectionIds), pluginConnection: { enabled: true } },
      order: { name: "ASC", pluginConnectionId: "ASC" },
    });
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
   * Runs a synced tool through its connection's driver. Failures the model
   * can act on (bad arguments, unreachable service) come back as an isError result.
   */
  async executeTool(toolId: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const tool = await this.tools.findOneByOrFail({ id: toolId });
    const conn = await this.findById(tool.pluginConnectionId);
    const manifest = this.manifests.get(conn.pluginKey);
    if (!conn.enabled || !manifest.capabilities.tools)
      return { content: "plugin connection is unavailable", isError: true };

    try {
      args = validateJson(tool.inputSchema, args);
    } catch (err) {
      return { content: `invalid arguments: ${describe(err)}`, isError: true };
    }
    try {
      const { driver, options } = this.drivers.resolve(manifest, "tools", conn.config)!;
      return await driver.callTool(conn.id, tool.name, args, options);
    } catch (err) {
      return { content: describe(err), isError: true, ...(isTimeout(err) && { timedOut: true }) };
    }
  }
}

/** The MCP error code of a timed out request; the SDK reports an abort as one too. */
const MCP_TIMEOUT: number = ErrorCode.RequestTimeout;

/** Whether the call failed by timing out. */
function isTimeout(err: unknown): boolean {
  return err instanceof McpError ? err.code === MCP_TIMEOUT : (err as Error)?.name === "TimeoutError";
}

function describe(err: unknown): string {
  if (err instanceof BadRequestException) return JSON.stringify(err.getResponse());
  return err instanceof Error ? err.message : String(err);
}
