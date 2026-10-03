import { KnowledgeItemStatus } from "@snipet/shared";
import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@snipet/server-common";

import type { KnowledgeItemKind, KnowledgeItem as KnowledgeItemContract } from "@snipet/shared";

// One object of the knowledge source. Its chunks live in the pgvector
// database, keyed by this id.
@Entity("knowledge_items")
export class KnowledgeItem extends BaseEntity implements KnowledgeItemContract {
  // The object's key in the source.
  @Index({ unique: true })
  @Column({ length: 1024 })
  externalId: string;

  @Column({ type: "text" })
  name: string;

  // Changes whenever the content does (the S3 ETag).
  @Column({ length: 128 })
  hash: string;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, unknown>;

  @Column({ type: "varchar", length: 32, nullable: true })
  kind: KnowledgeItemKind | null;

  @Index()
  @Column({ type: "varchar", length: 20, default: KnowledgeItemStatus.PENDING })
  status: KnowledgeItemStatus;

  // Why the item was skipped.
  @Column({ type: "text", nullable: true })
  reason: string | null;

  @Column({ type: "text", nullable: true })
  lastError: string | null;

  @Column({ type: "timestamptz", nullable: true })
  indexedAt: Date | null;

  // When the object last changed in the source.
  @Column({ type: "timestamptz", nullable: true })
  lastModified: Date | null;
}
