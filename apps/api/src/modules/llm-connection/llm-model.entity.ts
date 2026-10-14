import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";

import { LlmConnection } from "./llm-connection.entity.js";

import type { LlmCapability, LlmModel as LlmModelContract } from "@snipet/shared";

// A model of a connection, as its models driver last listed it (see the sync).
@Entity("llm_models")
@Unique(["llmConnectionId", "key"])
export class LlmModel extends BaseEntity implements LlmModelContract {
  @Column({ type: "uuid" })
  llmConnectionId: string;

  @ManyToOne(() => LlmConnection, { onDelete: "CASCADE" })
  @JoinColumn({ name: "llmConnectionId" })
  llmConnection?: LlmConnection;

  @Column({ length: 255 })
  key: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Column({ type: "text", array: true, default: "{}" })
  capabilities: LlmCapability[];

  @Column({ type: "integer", default: 0 })
  contextWindow: number;

  @Column({ type: "integer", nullable: true })
  maxOutputTokens: number | null;
}
