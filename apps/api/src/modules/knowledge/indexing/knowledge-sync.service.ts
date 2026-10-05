import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { sleep } from "@snipet/server-common";
import { KnowledgeItemStatus } from "@snipet/shared";
// import { setTimeout as sleep } from "node:timers/promises";
import { Repository } from "typeorm";

import { env } from "../../../env.js";
import { PgvectorService } from "../../../infra/pgvector/pgvector.service.js";
import { S3Source } from "../../../infra/storage/s3-source.js";
import { KnowledgeItem } from "../knowledge-item.entity.js";
import { knowledgeEnabled } from "../utils.js";

import { KnowledgeIndexerService } from "./knowledge-indexer.service.js";

import type { QueryDeepPartialEntity } from "typeorm";
const UPSERT_BATCH = 500;

export interface SyncResult {
  upserted: number;
  deleted: number;
}

// Keeps knowledge_items in line with the source bucket, on boot, every
// KNOWLEDGE_SYNC_INTERVAL_SECONDS and on demand: new or changed objects (by
// ETag) become pending, removed ones are deleted with their chunks. Then
// wakes the indexer, which picks up pending items.
@Injectable()
export class KnowledgeSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KnowledgeSyncService.name);
  private running?: Promise<SyncResult>;

  constructor(
    @InjectRepository(KnowledgeItem) private readonly itemsRepo: Repository<KnowledgeItem>,
    private readonly source: S3Source,
    private readonly pgvector: PgvectorService,
    private readonly indexer: KnowledgeIndexerService,
  ) {}

  async onApplicationBootstrap() {
    if (env.KNOWLEDGE_INDEX_RESET) {
      this.logger.warn("Resetting knowledge index");
      await this.itemsRepo.update({ status: KnowledgeItemStatus.INDEXED }, { status: KnowledgeItemStatus.PENDING });
      await this.pgvector.dropAndCreate();
    }

    if (!knowledgeEnabled()) return;
    // ponytail: assumes a single API instance; with replicas, a booting one
    // would requeue items another is still indexing.
    await this.itemsRepo.update({ status: KnowledgeItemStatus.INDEXING }, { status: KnowledgeItemStatus.PENDING });
    if (env.KNOWLEDGE_INDEX_ERRORS) {
      await this.itemsRepo.update({ status: KnowledgeItemStatus.ERROR }, { status: KnowledgeItemStatus.PENDING });
    }
    void this.syncRecursive();
  }

  // Starts a sync in the background unless one is running. Never throws: a
  // failed sync is caught up by the next one.
  async syncRecursive(): Promise<void> {
    const sync = async () => {
      try {
        await this.sync();
      } catch (err) {
        this.logger.error(`knowledge sync failed: ${String(err)}`);
      }
    };
    while (true) {
      await sync();
      await sleep(1000 * env.KNOWLEDGE_SYNC_INTERVAL_SECONDS);
    }
  }

  // At most one at a time: a call while one runs gets that one's result.
  sync(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => (this.running = undefined));
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    const existing = new Map(
      (await this.itemsRepo.find({ select: { id: true, externalId: true, hash: true } })).map((i) => [i.externalId, i]),
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
      await this.itemsRepo.upsert(changed.slice(start, start + UPSERT_BATCH), ["externalId"]);
    }

    // What is left was not listed: gone from the source. Chunks first, so a
    // failure leaves the item for the next sync to retry.
    const gone = [...existing.values()].map((i) => i.id);
    if (gone.length) {
      await this.pgvector.deleteByItemIds(gone);
      await this.itemsRepo.delete(gone);
    }

    // Also on no change: retries pending items left by a rate limit or error.
    this.indexer.wake();
    this.logger.log(`knowledge sync: upserted=${changed.length} deleted=${gone.length}`);
    return { upserted: changed.length, deleted: gone.length };
  }
}
