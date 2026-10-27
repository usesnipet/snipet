import type { JsonObject, LlmConnection as LlmConnectionContract } from "@snipet/shared";
import { sealConfig } from "#src/manifest/seal-config.js";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, Index } from "typeorm";

@Entity("llm_connections")
/** At most one default per llm. */
@Index(["llmKey"], { unique: true, where: `"default"` })
export class LlmConnection extends BaseEntity implements LlmConnectionContract {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  llmKey: string;

  @Column({ type: "text", transformer: sealConfig })
  config: JsonObject;

  @Column({ default: false })
  enabled: boolean;

  @Column({ default: false })
  default: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastSyncedError: string | null;
}
