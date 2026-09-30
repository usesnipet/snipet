import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { KnowledgeItemStatus } from "@snipet/shared";
import { Repository } from "typeorm";

import { env, knowledgeEnabled } from "../../env.js";
import { PgvectorService } from "../pgvector/pgvector.service.js";

import { KnowledgeIndexService } from "./knowledge-index.service.js";
import { KnowledgeItem } from "./knowledge-item.entity.js";
import { S3Source } from "./s3-source.js";

import type { QueryDeepPartialEntity } from "typeorm";

const UPSERT_BATCH = 500;

export interface SyncResult {
  upserted: number;
  deleted: number;
}

// Keeps knowledge_items in line with the source bucket, on boot and every
// KNOWLEDGE_SYNC_INTERVAL_SECONDS: new or changed objects (by ETag) become
// pending and are queued for indexing, removed ones are deleted with their chunks.
@Injectable()
export class KnowledgeSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeSyncService.name);
  private running?: Promise<SyncResult>;
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(KnowledgeItem) private readonly items: Repository<KnowledgeItem>,
    private readonly source: S3Source,
    private readonly pgvector: PgvectorService,
    private readonly indexer: KnowledgeIndexService,
  ) {}

  onApplicationBootstrap() {
    if (!knowledgeEnabled) return;
    // Items left indexing by a crash are picked up again.
    void this.enqueue(KnowledgeItemStatus.ERROR);
    void this.enqueue(KnowledgeItemStatus.INDEXING).then(() => this.trigger());
    if (env.KNOWLEDGE_SYNC_INTERVAL_SECONDS > 0) {
      this.timer = setInterval(() => this.trigger(), env.KNOWLEDGE_SYNC_INTERVAL_SECONDS * 1000);
    }
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Starts a sync unless one is running, without blocking the caller.
  trigger() {
    this.sync().catch((err: unknown) => this.logger.error(`knowledge sync failed: ${String(err)}`));
  }

  // Joins the running sync, if any.
  sync(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => (this.running = undefined));
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    const existing = new Map(
      (await this.items.find({ select: { id: true, externalId: true, hash: true } })).map((i) => [i.externalId, i]),
    );

    const changed: QueryDeepPartialEntity<KnowledgeItem>[] = [];
    for await (const obj of this.source.list()) {
      const known = existing.get(obj.key);
      existing.delete(obj.key);
      if (known?.hash === obj.hash) continue;
      changed.push({
        externalId: obj.key,
        name: obj.name,
        hash: obj.hash,
        metadata: { size: obj.size },
        lastModified: obj.lastModified,
        status: KnowledgeItemStatus.PENDING,
        reason: null,
        lastError: null,
      });
    }
    for (let start = 0; start < changed.length; start += UPSERT_BATCH) {
      await this.items.upsert(changed.slice(start, start + UPSERT_BATCH), ["externalId"]);
    }

    // What is left was not listed: gone from the source. Chunks first, so a
    // failure leaves the item for the next sync to retry.
    const gone = [...existing.values()].map((i) => i.id);
    if (gone.length) {
      await this.pgvector.deleteByItemIds(gone);
      await this.items.delete(gone);
    }

    await this.enqueue(KnowledgeItemStatus.PENDING);
    this.logger.log(`knowledge sync: upserted=${changed.length} deleted=${gone.length}`);
    return { upserted: changed.length, deleted: gone.length };
  }

  private async enqueue(status: KnowledgeItemStatus) {
    const items = await this.items.find({ select: { id: true }, where: { status } });
    for (const { id } of items) this.indexer.enqueue(id);
  }
}
