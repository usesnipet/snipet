import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { KnowledgeItemStatus } from "@snipet/shared";
import { Queue } from "bullmq";
import { Repository } from "typeorm";

import { env, knowledgeEnabled } from "../../../env.js";

import { KNOWLEDGE_INDEX_QUEUE, KnowledgeIndexJob } from "./knowledge-index.processor.js";
import { KnowledgeItem } from "../knowledge-item.entity.js";

// Here, not in the processor: the processor imports this file.
export const KNOWLEDGE_SYNC_QUEUE = "knowledge-sync";

// Enqueues source syncs, on boot and every KNOWLEDGE_SYNC_INTERVAL_SECONDS or
// on demand through trigger(), and item indexing through enqueueIndex().
@Injectable()
export class KnowledgeSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeSyncService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(KnowledgeItem) private readonly items: Repository<KnowledgeItem>,
    @InjectQueue(KNOWLEDGE_SYNC_QUEUE) private readonly syncQueue: Queue,
    @InjectQueue(KNOWLEDGE_INDEX_QUEUE) private readonly indexQueue: Queue<KnowledgeIndexJob>,
  ) {}

  onApplicationBootstrap() {
    if (!knowledgeEnabled) return;
    // Items whose indexing failed or whose job got lost are picked up again.
    void this.enqueueIndex(KnowledgeItemStatus.INDEXING).then(() => this.trigger());
    if (env.KNOWLEDGE_SYNC_INTERVAL_SECONDS > 0) {
      this.timer = setInterval(() => void this.trigger(), env.KNOWLEDGE_SYNC_INTERVAL_SECONDS * 1000);
    }
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Starts a sync unless one is waiting or running. Never throws: a failed
  // enqueue is caught up by the periodic sync.
  async trigger(): Promise<void> {
    try {
      await this.syncQueue.add(
        "sync",
        {},
        { deduplication: { id: "source" }, removeOnComplete: 100, removeOnFail: 100 },
      );
    } catch (err) {
      this.logger.warn(`enqueue knowledge sync: ${String(err)}`);
    }
  }

  // Queues indexing of every item in the status. At most one waiting and one
  // active job per item: adds while one runs queue a single follow-up, since
  // its content may have changed since. Never throws, like trigger().
  async enqueueIndex(status: KnowledgeItemStatus): Promise<void> {
    try {
      const items = await this.items.find({ select: { id: true }, where: { status } });
      await this.indexQueue.addBulk(
        items.map(({ id }) => ({
          name: "index",
          data: { itemId: id },
          opts: { deduplication: { id, keepLastIfActive: true }, removeOnComplete: true, removeOnFail: 100 },
        })),
      );
    } catch (err) {
      this.logger.error(`enqueue indexing of ${status} knowledge items: ${String(err)}`);
    }
  }
}
