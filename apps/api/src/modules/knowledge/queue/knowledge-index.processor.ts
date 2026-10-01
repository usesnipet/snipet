import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { KnowledgeItemKind, KnowledgeItemStatus } from "@snipet/shared";
import { ChunkerType, extract as xbergExtract, ExtractInputKind } from "@xberg-io/xberg";
import { Repository } from "typeorm";

import { env } from "../../../env.js";
import { EmbeddingService } from "../../../infra/embedding/embedding.service.js";
import { PgvectorService } from "../../../infra/pgvector/pgvector.service.js";

import { KnowledgeItem } from "../knowledge-item.entity.js";
import { S3Source } from "../../../infra/storage/s3-source.js";

import type { Job } from "bullmq";
import type { ExtractedDocument, ExtractionResult } from "@xberg-io/xberg";
import type { QueryDeepPartialEntity } from "typeorm";

export const KNOWLEDGE_INDEX_QUEUE = "knowledge-index";
export type KnowledgeIndexJob = { itemId: string };

// xberg's error for a format it has no extractor for; retrying won't help.
class UnsupportedFormatError extends Error {}

// Extracts each queued item with xberg, embeds its chunks and stores them in
// pgvector. Jobs are enqueued by KnowledgeSyncService.
@Processor(KNOWLEDGE_INDEX_QUEUE, { concurrency: env.KNOWLEDGE_INDEX_CONCURRENCY })
export class KnowledgeIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeIndexProcessor.name);

  constructor(
    @InjectRepository(KnowledgeItem) private readonly items: Repository<KnowledgeItem>,
    private readonly source: S3Source,
    private readonly embedding: EmbeddingService,
    private readonly pgvector: PgvectorService,
  ) {
    super();
  }

  process(job: Job<KnowledgeIndexJob>): Promise<void> {
    return this.index(job.data.itemId);
  }

  // Replaces the item's chunks with the ones extracted from its current
  // content and records the outcome on the item.
  async index(id: string): Promise<void> {
    const item = await this.items.findOneBy({ id });
    if (!item) return;
    await this.items.update(id, { status: KnowledgeItemStatus.INDEXING });
    let kind: KnowledgeItemKind;
    try {
      // ponytail: whole object in memory and extraction in the API process;
      // stream it or move indexing to a worker if files get big.
      const { bytes } = await this.source.read(item.externalId);
      const doc = await extract(item.name, bytes);
      kind = kindFromMime(doc.mimeType ?? "");
      const chunks = doc.chunks ?? [];
      const vectors = await this.embedding.embed(chunks.map((c) => c.content));
      await this.pgvector.replaceChunks(
        id,
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
      if (err instanceof UnsupportedFormatError) {
        this.logger.log(`skipped ${item.externalId}: ${message}`);
        await this.finish(item, { status: KnowledgeItemStatus.SKIPPED, reason: message });
      } else {
        this.logger.warn(`index ${item.externalId} failed: ${message}`);
        await this.finish(item, { status: KnowledgeItemStatus.ERROR, lastError: message });
        throw err; // marks the job failed in Bull Board
      }
      return;
    }
    await this.finish(item, { status: KnowledgeItemStatus.INDEXED, kind, indexedAt: new Date() });
  }

  // Only while the item still has the content that was indexed: a newer sync
  // has set it back to pending and enqueued it again.
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
