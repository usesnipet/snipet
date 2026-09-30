import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ToolSource } from "@snipet/shared";
import { Repository } from "typeorm";

import { env } from "../../env.js";
import { Tool } from "../tool/tool.entity.js";

import { McpServer } from "./mcp-server.entity.js";
import { McpConnector, RemoteTool } from "./mcp/connector.js";

const MAX_CONCURRENT_SYNCS = 4;
const MAX_ERROR_LENGTH = 255;

// Keeps the tools table in line with what each MCP server advertises: every
// server on boot and on every MCP_SYNC_INTERVAL_SECONDS, single servers on
// demand through enqueue().
@Injectable()
export class McpServerSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(McpServerSyncService.name);
  // Ids queued or syncing, so a server is never synced twice at once.
  private readonly pending = new Set<string>();
  private readonly queue: string[] = [];
  private running = 0;
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(McpServer) private readonly servers: Repository<McpServer>,
    private readonly connector: McpConnector,
  ) {}

  onApplicationBootstrap() {
    void this.enqueueAll();
    if (env.MCP_SYNC_INTERVAL_SECONDS > 0) {
      this.timer = setInterval(() => void this.enqueueAll(), env.MCP_SYNC_INTERVAL_SECONDS * 1000);
    }
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Schedules a sync without blocking the caller.
  enqueue(id: string) {
    if (this.pending.has(id)) return;
    this.pending.add(id);
    this.queue.push(id);
    this.drain();
  }

  // Replaces the server's tools with the ones it lists now, matched by name.
  // When the server can't be reached the previous tools are kept and the
  // error is recorded on the server.
  async syncServer(id: string): Promise<void> {
    const server = await this.servers.findOneByOrFail({ id });

    let remote: RemoteTool[];
    try {
      remote = await this.connector.listTools(server.transport, server.config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.servers.update(id, { lastSyncedAt: new Date(), lastSyncedError: message.slice(0, MAX_ERROR_LENGTH) });
      throw err;
    }

    await this.servers.manager.transaction(async (m) => {
      const tools = m.getRepository(Tool);
      const stale = new Map((await tools.findBy({ mcpServerId: id })).map((t) => [t.name, t.id]));
      for (const t of remote) {
        const existingId = stale.get(t.name);
        stale.delete(t.name);
        if (existingId) {
          await tools.save({ id: existingId, description: t.description, inputSchema: t.inputSchema });
        } else {
          await tools.save({ ...t, source: ToolSource.MCP, mcpServerId: id });
        }
      }
      if (stale.size) await tools.delete([...stale.values()]);
    });
    await this.servers.update(id, { lastSyncedAt: new Date(), lastSyncedError: null });
  }

  private drain() {
    while (this.running < MAX_CONCURRENT_SYNCS && this.queue.length) {
      const id = this.queue.shift()!;
      this.running++;
      this.syncServer(id)
        .catch((err: unknown) => this.logger.warn(`sync of mcp server ${id} failed: ${String(err)}`))
        .finally(() => {
          this.running--;
          this.pending.delete(id);
          this.drain();
        });
    }
  }

  private async enqueueAll() {
    try {
      for (const { id } of await this.servers.find({ select: { id: true } })) this.enqueue(id);
    } catch (err) {
      this.logger.error(`list mcp servers to sync: ${String(err)}`);
    }
  }
}
