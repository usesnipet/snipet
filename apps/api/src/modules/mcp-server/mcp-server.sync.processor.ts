import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { ToolSource } from "@snipet/shared";
import { Repository } from "typeorm";

import { env } from "../../env.js";
import { Tool } from "../tool/tool.entity.js";

import { McpServer } from "./mcp-server.entity.js";
import { McpConnector, RemoteTool } from "./mcp/connector.js";

import type { Job } from "bullmq";

export const MCP_SYNC_QUEUE = "mcp-server-sync";
export type McpSyncJob = { serverId: string };

const MAX_ERROR_LENGTH = 255;

// Keeps the tools table in line with what an MCP server advertises. Jobs are
// enqueued by McpServerSyncService.
@Processor(MCP_SYNC_QUEUE, { concurrency: env.MCP_SYNC_CONCURRENCY })
export class McpServerSyncProcessor extends WorkerHost {
  constructor(
    @InjectRepository(McpServer) private readonly servers: Repository<McpServer>,
    private readonly connector: McpConnector,
  ) {
    super();
  }

  process(job: Job<McpSyncJob>): Promise<void> {
    return this.syncServer(job.data.serverId);
  }

  // Replaces the server's tools with the ones it lists now, matched by name.
  // When the server can't be reached the previous tools are kept and the
  // error is recorded on the server. Servers deleted since enqueue are skipped.
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
