import type { UsageRecord as UsageRecordContract } from "@snipet/shared";
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

import type { ValueTransformer } from "typeorm";

/** pg returns numeric as a string, to keep its precision; prices fit a number. */
const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** Ids are plain columns, not foreign keys: deleting an agent or session keeps its usage. */
@Entity("usage_records")
@Index(["agentId", "createdAt"])
export class UsageRecord implements UsageRecordContract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "uuid" })
  agentId: string;

  @Column({ type: "uuid" })
  sessionId: string;

  @Column({ type: "uuid" })
  runId: string;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @Column({ type: "uuid", nullable: true })
  appId: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  externalUserId: string | null;

  @Column({ type: "uuid" })
  connectionId: string;

  @Column({ type: "varchar", length: 255 })
  model: string;

  @Column({ type: "int" })
  inputTokens: number;

  @Column({ type: "int" })
  outputTokens: number;

  @Column({ type: "int", default: 0 })
  cachedInputTokens: number;

  @Column({ type: "numeric", precision: 12, scale: 6, nullable: true, transformer: numericTransformer })
  inputPrice: number | null;

  @Column({ type: "numeric", precision: 12, scale: 6, nullable: true, transformer: numericTransformer })
  outputPrice: number | null;

  @Column({ type: "numeric", precision: 12, scale: 6, nullable: true, transformer: numericTransformer })
  cachedInputPrice: number | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
