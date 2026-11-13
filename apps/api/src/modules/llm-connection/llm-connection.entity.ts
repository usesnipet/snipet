import type { JsonObject } from "@snipet/shared";
import type { LLMModel } from "@snipet/shared/core";
import type { LlmConnection as LlmConnectionContract } from "@snipet/shared";
import { sealConfig } from "#src/infra/database/seal-config.js";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity } from "typeorm";

@Entity("llm_connections")
export class LlmConnection extends BaseEntity implements LlmConnectionContract {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  llmKey: string;

  @Column({ type: "text", transformer: sealConfig })
  config: JsonObject;

  @Column({ default: false })
  enabled: boolean;

  /** What the models driver listed on the last sync. Only loaded on request: it would weigh down every listing. */
  @Column({ type: "jsonb", default: [], select: false })
  models: LLMModel[];

  @Column({ type: "timestamptz", nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastSyncedError: string | null;
}
