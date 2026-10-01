import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { KnowledgeItemStatus } from "@snipet/shared";
import { Repository } from "typeorm";

import { PgvectorService } from "../pgvector/pgvector.service.js";

import { KnowledgeItem } from "./knowledge-item.entity.js";
import { KNOWLEDGE_SYNC_QUEUE, KnowledgeSyncService } from "./knowledge-sync.service.js";
import { S3Source } from "./s3-source.js";

import type { QueryDeepPartialEntity } from "typeorm";

const UPSERT_BATCH = 500;

export interface SyncResult {
  upserted: number;
  deleted: number;
}

// Keeps knowledge_items in line with the source bucket: new or changed
// objects (by ETag) become pending and are queued for indexing, removed ones
// are deleted with their chunks. Jobs are enqueued by KnowledgeSyncService.
@Processor(KNOWLEDGE_SYNC_QUEUE)
export class KnowledgeSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeSyncProcessor.name);

  constructor(
    @InjectRepository(KnowledgeItem) private readonly items: Repository<KnowledgeItem>,
    private readonly source: S3Source,
    private readonly pgvector: PgvectorService,
    private readonly syncService: KnowledgeSyncService,
  ) {
    super();
  }

  // The result is kept on the job, so it shows up in Bull Board.
  async process(): Promise<SyncResult> {
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

    await this.syncService.enqueueIndex(KnowledgeItemStatus.PENDING);
    this.logger.log(`knowledge sync: upserted=${changed.length} deleted=${gone.length}`);
    return { upserted: changed.length, deleted: gone.length };
  }
}
