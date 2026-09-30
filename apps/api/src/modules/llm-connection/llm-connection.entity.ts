import type { LlmConnection as LlmConnectionContract } from "@snipet/shared";
import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "../../common/crud/base.entity.js";

@Entity("llm_connections")
// At most one default per provider; the service keeps it at exactly one.
@Index(["provider"], { unique: true, where: `"default"` })
export class LlmConnection extends BaseEntity implements LlmConnectionContract {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  provider: string;

  @Column({ type: "jsonb" })
  config: Record<string, unknown>;

  @Column({ default: false })
  enabled: boolean;

  @Column({ default: false })
  default: boolean;
}
