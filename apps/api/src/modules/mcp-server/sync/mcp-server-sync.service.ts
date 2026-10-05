import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { sleep } from "@snipet/server-common";
import { ToolSource } from "@snipet/shared";
import { Repository } from "typeorm";

import { env } from "../../../env.js";
import { McpConnector, RemoteTool } from "../../../infra/mcp/connector.js";
import { Tool } from "../../tool/tool.entity.js";
import { McpServer } from "../mcp-server.entity.js";

const MAX_ERROR_LENGTH = 255;

// Keeps the tools table in line with what each MCP server advertises: every
// server on boot and every MCP_SYNC_INTERVAL_SECONDS (0 = boot only), up to
// MCP_SYNC_CONCURRENCY at a time, and single servers on demand through sync().
@Injectable()
export class McpServerSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(McpServerSyncService.name);
  private readonly running = new Map<string, Promise<void>>();
  // Servers asked to sync while one of theirs ran: synced once more after it.
  private readonly again = new Set<string>();
  private stopped = false;

  constructor(
    @InjectRepository(McpServer) private readonly servers: Repository<McpServer>,
    private readonly connector: McpConnector,
  ) {}

  onApplicationBootstrap() {
    void this.syncRecursive();
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  private async syncRecursive(): Promise<void> {
    while (!this.stopped) {
      await this.syncAll();
      await sleep(1000 * env.MCP_SYNC_INTERVAL_SECONDS);
    }
  }

  private async syncAll(): Promise<void> {
    let ids: string[];
    try {
      ids = (await this.servers.find({ select: { id: true } })).map((s) => s.id);
    } catch (err) {
      this.logger.error(`list mcp servers to sync: ${String(err)}`);
      return;
    }
    const worker = async () => {
      for (let id = ids.pop(); id && !this.stopped; id = ids.pop()) await this.sync(id);
    };
    await Promise.all(Array.from({ length: env.MCP_SYNC_CONCURRENCY }, worker));
  }

  // At most one sync per server at a time; a call while one runs gets a
  // single follow-up, so a config change made mid-sync is still picked up.
  // Never throws: the error is recorded on the server and the next sync retries.
  sync(id: string): Promise<void> {
    const current = this.running.get(id);
    if (current) {
      this.again.add(id);
      return current;
    }
    const run = this.syncServer(id)
      .catch((err) => this.logger.warn(`sync mcp server ${id}: ${String(err)}`))
      .finally(() => {
        this.running.delete(id);
        if (this.again.delete(id)) void this.sync(id);
      });
    this.running.set(id, run);
    return run;
  }

  // Replaces the server's tools with the ones it lists now, matched by name.
  // When the server can't be reached the previous tools are kept and the
  // error is recorded on the server. Deleted servers are skipped.
  async syncServer(id: string): Promise<void> {
    const server = await this.servers.findOneBy({ id });
    if (!server) return;

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
}
