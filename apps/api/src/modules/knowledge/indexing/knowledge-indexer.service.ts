import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { KnowledgeItemKind, KnowledgeItemStatus } from "@snipet/shared";
import { ChunkerType, extract as xbergExtract, ExtractInputKind } from "@xberg-io/xberg";
import { setTimeout as sleep } from "node:timers/promises";
import { RateLimitError as EmbeddingRateLimitError } from "openai";
import { In, Not, Repository } from "typeorm";

import { env } from "../../../env.js";
import { EmbeddingService } from "../../../infra/embedding/embedding.service.js";
import { PgvectorService } from "../../../infra/pgvector/pgvector.service.js";
import { S3Source } from "../../../infra/storage/s3-source.js";
import { KnowledgeItem } from "../knowledge-item.entity.js";

import type { ExtractedDocument, ExtractionResult } from "@xberg-io/xberg";
import type { QueryDeepPartialEntity } from "typeorm";

// xberg's error for a format it has no extractor for; retrying won't help.
class UnsupportedFormatError extends Error {}

// Pause when the embedding API rate limits without a Retry-After.
const RATE_LIMIT_FALLBACK_MS = 60_000;

// Indexes pending items in the background, up to KNOWLEDGE_INDEX_CONCURRENCY
// at a time: each worker claims a pending item (pending -> indexing), extracts
// it with xberg, embeds its chunks and stores them in pgvector, until none is
// left. The item status is the queue; wake() starts workers after a sync.
@Injectable()
export class KnowledgeIndexerService implements OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeIndexerService.name);
  private workers = 0;
  // Set by wake() so a worker that just found nothing looks once more.
  private woken = false;
  private stopped = false;
  private pausedUntil = 0;
  // Never claimed twice at once, even when a sync makes it pending again mid-index.
  private readonly active = new Set<string>();

  constructor(
    @InjectRepository(KnowledgeItem) private readonly items: Repository<KnowledgeItem>,
    private readonly source: S3Source,
    private readonly embedding: EmbeddingService,
    private readonly pgvector: PgvectorService,
  ) {}

  onModuleDestroy() {
    // Workers stop after their current item; one cut short stays indexing
    // and is set back to pending on the next boot.
    this.stopped = true;
  }

  wake(): void {
    this.woken = true;
    while (!this.stopped && this.workers < env.KNOWLEDGE_INDEX_CONCURRENCY) {
      this.workers++;
      void this.work().finally(() => this.workers--);
    }
  }

  private async work(): Promise<void> {
    while (!this.stopped) {
      const wait = this.pausedUntil - Date.now();
      if (wait > 0) await sleep(wait);
      let item: KnowledgeItem | null;
      try {
        item = await this.claim();
      } catch (err) {
        this.logger.error(`claim knowledge item: ${String(err)}`);
        return; // the next sync wakes the workers again
      }
      if (!item) {
        if (!this.woken) return;
        this.woken = false;
        continue;
      }
      this.active.add(item.id);
      try {
        await this.index(item);
      } catch (err) {
        this.logger.error(`index ${item.externalId}: ${String(err)}`);
      } finally {
        this.active.delete(item.id);
      }
    }
  }

  // Takes the oldest pending item. The conditional update makes it safe
  // against another worker (or instance) claiming the same one.
  private async claim(): Promise<KnowledgeItem | null> {
    for (;;) {
      const item = await this.items.findOne({
        where: { status: KnowledgeItemStatus.PENDING, id: Not(In([...this.active])) },
        order: { createdAt: "ASC" },
      });
      if (!item) return null;
      const { affected } = await this.items.update(
        { id: item.id, status: KnowledgeItemStatus.PENDING },
        { status: KnowledgeItemStatus.INDEXING },
      );
      if (affected) return item;
    }
  }

  // Replaces the item's chunks with the ones extracted from its current
  // content and records the outcome on the item.
  async index(item: KnowledgeItem): Promise<void> {
    let kind: KnowledgeItemKind;
    try {
      // ponytail: whole object in memory and extraction in the API process;
      // stream it or move indexing to a worker thread if files get big.
      const { bytes } = await this.source.read(item.externalId);
      const doc = await extract(item.name, bytes);
      kind = kindFromMime(doc.mimeType ?? "");
      const chunks = doc.chunks ?? [];
      console.log("chunks", chunks.length);

      const vectors = await this.embedding.embed(chunks.map((c) => c.content));
      await this.pgvector.replaceChunks(
        item.id,
        chunks.map((c, i) => ({
          content: c.content,
          embedding: vectors[i],
          metadata: {
            name: item.name,
            externalId: item.externalId,
            mimeType: doc.mimeType,
            chunkType: c.chunkType,
            headingPath: c.metadata.headingPath,
            firstPage: c.metadata.firstPage,
            lastPage: c.metadata.lastPage,
          },
        })),
      );
      this.logger.log(`indexed ${item.externalId}: kind=${kind} chunks=${chunks.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof EmbeddingRateLimitError) {
        // Pauses every worker, since the limit is the provider's; the item
        // goes back to pending.
        const ms = retryAfterMs(err.headers) ?? RATE_LIMIT_FALLBACK_MS;
        this.logger.warn(`index ${item.externalId} rate limited, pausing ${ms}ms: ${message}`);
        this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms);
        await this.finish(item, { status: KnowledgeItemStatus.PENDING });
      } else if (err instanceof UnsupportedFormatError) {
        this.logger.log(`skipped ${item.externalId}: ${message}`);
        await this.finish(item, { status: KnowledgeItemStatus.SKIPPED, reason: message });
      } else {
        this.logger.warn(`index ${item.externalId} failed: ${message}`);
        await this.finish(item, { status: KnowledgeItemStatus.ERROR, lastError: message });
      }
      return;
    }
    await this.finish(item, { status: KnowledgeItemStatus.INDEXED, kind, indexedAt: new Date() });
  }

  // Only while the item still has the content that was indexed: a newer sync
  // has set it back to pending for the workers to pick up again.
  private finish(item: KnowledgeItem, update: QueryDeepPartialEntity<KnowledgeItem>) {
    return this.items.update({ id: item.id, hash: item.hash }, { reason: null, lastError: null, ...update });
  }
}

// Loaded on first use, so the native binding is only needed with knowledge on.
async function extract(filename: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  let result: ExtractionResult;
  try {
    result = await xbergExtract(
      { kind: ExtractInputKind.Bytes, bytes, filename },
      {
        outputFormat: "markdown",
        chunking: {
          maxCharacters: env.CHUNK_MAX_CHARACTERS,
          overlap: env.CHUNK_OVERLAP,
          chunkerType: ChunkerType.Markdown,
        },
      },
    );
  } catch (err) {
    if (isUnsupported(err)) throw new UnsupportedFormatError((err as Error).message);
    throw err;
  }
  const error = result.errors?.[0];
  if (error) {
    if (isUnsupported(error)) throw new UnsupportedFormatError(error.message);
    throw new Error(error.message);
  }
  const doc = result.results?.[0];
  if (!doc) throw new Error("xberg: empty result");
  return doc;
}

// Retry-After is in seconds or an HTTP date.
function retryAfterMs(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const ms = Number.isNaN(Number(value)) ? Date.parse(value) - Date.now() : Number(value) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

// Thrown as "Unsupported format: <mime>" or reported as errorType unsupported_format.
function isUnsupported(err: unknown): boolean {
  const e = err as { errorType?: string; message?: string };
  return e.errorType === "unsupported_format" || /^unsupported format/i.test(e.message ?? "");
}

export function kindFromMime(mimeType: string): KnowledgeItemKind {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  if (mime.startsWith("image/")) return KnowledgeItemKind.IMAGE;
  if (mime.startsWith("audio/")) return KnowledgeItemKind.AUDIO;
  if (mime.startsWith("video/")) return KnowledgeItemKind.VIDEO;
  if (["application/json", "text/csv"].includes(mime) || mime.endsWith("/xml") || mime.endsWith("yaml")) {
    return KnowledgeItemKind.STRUCTURED;
  }
  if (mime.startsWith("text/")) return KnowledgeItemKind.TEXT;
  if (
    ["application/pdf", "application/msword", "application/rtf"].includes(mime) ||
    mime.startsWith("application/vnd.openxmlformats-officedocument") ||
    mime.startsWith("application/vnd.oasis.opendocument")
  ) {
    return KnowledgeItemKind.DOCUMENT;
  }
  return KnowledgeItemKind.UNKNOWN;
}
