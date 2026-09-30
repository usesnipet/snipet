import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// Where a knowledge item is in the indexing pipeline. pending: new or changed
// in the source, waiting to be indexed; skipped: format not supported.
export enum KnowledgeItemStatus {
  PENDING = "pending",
  INDEXING = "indexing",
  INDEXED = "indexed",
  SKIPPED = "skipped",
  ERROR = "error",
}
export const knowledgeItemStatusSchema = z.enum(KnowledgeItemStatus);

// Content class, from the MIME type detected at extraction.
export enum KnowledgeItemKind {
  TEXT = "text",
  DOCUMENT = "document",
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  STRUCTURED = "structured",
  UNKNOWN = "unknown",
}
export const knowledgeItemKindSchema = z.enum(KnowledgeItemKind);

// One object of the knowledge source (e.g. an S3 key). Items are not created
// by clients: the source sync keeps them in line with the source.
export const knowledgeItemSchema = z.object({
  id: z.uuid(),
  externalId: z.string(),
  name: z.string(),
  hash: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  kind: knowledgeItemKindSchema.nullable(),
  status: knowledgeItemStatusSchema,
  reason: z.string().nullable(),
  lastError: z.string().nullable(),
  indexedAt: z.coerce.date().nullable(),
  lastModified: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type KnowledgeItem = z.infer<typeof knowledgeItemSchema>;

export const paginatedKnowledgeItemSchema = paginatedSchema(knowledgeItemSchema);

export const findKnowledgeItemsParamsSchema = paginationParamsSchema.extend({
  // Matches the name, case-insensitive.
  search: z.string().trim().max(255).optional(),
  status: knowledgeItemStatusSchema.optional(),
  kind: knowledgeItemKindSchema.optional(),
});
export type FindKnowledgeItemsParams = z.infer<typeof findKnowledgeItemsParamsSchema>;

export const knowledgeSearchParamsSchema = z.object({
  q: z.string().trim().min(1).max(1000),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type KnowledgeSearchParams = z.infer<typeof knowledgeSearchParamsSchema>;

// A chunk ranked by Reciprocal Rank Fusion of vector and full-text rank.
export const knowledgeSearchResultSchema = z.object({
  id: z.uuid(),
  knowledgeItemId: z.uuid(),
  chunkIndex: z.number(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  score: z.number(),
});
export type KnowledgeSearchResult = z.infer<typeof knowledgeSearchResultSchema>;
