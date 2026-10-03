import type { LlmConnection as LlmConnectionContract } from "@snipet/shared";
import { Column, Entity, Index } from "typeorm";

import { BaseEntity, open, seal } from "@snipet/server-common";
import { env } from "../../env.js";

import type { ValueTransformer } from "typeorm";

// `auth` holds credentials, so it is stored sealed; the rest of config stays
// plain jsonb. Rows written before encryption (plain `auth` object) still read.
const sealAuth: ValueTransformer = {
  to: (value?: Record<string, unknown> | null) =>
    value?.auth ? { ...value, auth: seal(JSON.stringify(value.auth), env.ENCRYPTION_KEY) } : value,
  from: (value?: Record<string, unknown> | null) =>
    value?.auth ? { ...value, auth: JSON.parse(open(value.auth as string, env.ENCRYPTION_KEY)) as unknown } : value,
};

@Entity("llm_connections")
// At most one default per provider; the service keeps it at exactly one.
@Index(["provider"], { unique: true, where: `"default"` })
export class LlmConnection extends BaseEntity implements LlmConnectionContract {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  provider: string;

  @Column({ type: "jsonb", transformer: sealAuth })
  config: Record<string, unknown>;

  @Column({ default: false })
  enabled: boolean;

  @Column({ default: false })
  default: boolean;
}
