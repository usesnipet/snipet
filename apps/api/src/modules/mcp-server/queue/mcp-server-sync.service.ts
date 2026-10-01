import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue } from "bullmq";
import { Repository } from "typeorm";

import { env } from "../../../env.js";

import { McpServer } from "../mcp-server.entity.js";
import { MCP_SYNC_QUEUE, McpSyncJob } from "./mcp-server-sync.processor.js";

// Enqueues MCP server tool syncs: every server on boot and on every
// MCP_SYNC_INTERVAL_SECONDS, single servers on demand through enqueue().
@Injectable()
export class McpServerSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(McpServerSyncService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(McpServer) private readonly servers: Repository<McpServer>,
    @InjectQueue(MCP_SYNC_QUEUE) private readonly queue: Queue<McpSyncJob>,
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

  // At most one waiting and one active job per server: adds while one waits
  // are dropped, adds while one runs queue a single follow-up, so a config
  // change made mid-sync is still picked up. Never throws: a failed enqueue
  // is caught up by the periodic sync.
  async enqueue(serverId: string): Promise<void> {
    try {
      await this.queue.add(
        "sync",
        { serverId },
        {
          deduplication: { id: serverId, keepLastIfActive: true },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (err) {
      this.logger.warn(`enqueue sync of mcp server ${serverId}: ${String(err)}`);
    }
  }

  private async enqueueAll() {
    try {
      for (const { id } of await this.servers.find({ select: { id: true } })) await this.enqueue(id);
    } catch (err) {
      this.logger.error(`list mcp servers to sync: ${String(err)}`);
    }
  }
}
