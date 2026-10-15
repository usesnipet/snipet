import type { JsonObject, LlmConnection as LlmConnectionContract } from "@snipet/shared";
import { env } from "#src/env.js";
import { BaseEntity, open, seal } from "@snipet/server-common";
import { Column, Entity, Index } from "typeorm";

import type { ValueTransformer } from "typeorm";

// The whole config is sealed: which fields are secret is only known from the
// manifest, and a field someone forgot to mark must not leak.
const sealConfig: ValueTransformer = {
  to: (value?: JsonObject | null) => (value ? seal(JSON.stringify(value), env.ENCRYPTION_KEY) : value),
  from: (value?: string | null) => (value ? (JSON.parse(open(value, env.ENCRYPTION_KEY)) as unknown) : value),
};

@Entity("llm_connections")
// At most one default per llm.
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
