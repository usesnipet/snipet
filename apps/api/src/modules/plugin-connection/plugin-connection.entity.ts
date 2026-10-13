import type { PluginConnection as PluginConnectionContract } from "@snipet/shared";
import { Column, Entity, Index } from "typeorm";

import { BaseEntity, open, seal } from "@snipet/server-common";
import { env } from "../../env.js";

import type { ValueTransformer } from "typeorm";

// The whole config is sealed: which fields are secret is only known from the
// manifest, and a field someone forgot to mark must not leak.
const sealConfig: ValueTransformer = {
  to: (value?: Record<string, unknown> | null) => (value ? seal(JSON.stringify(value), env.ENCRYPTION_KEY) : value),
  from: (value?: string | null) => (value ? (JSON.parse(open(value, env.ENCRYPTION_KEY)) as unknown) : value),
};

@Entity("plugin_connections")
export class PluginConnection extends BaseEntity implements PluginConnectionContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Index()
  @Column({ length: 255 })
  pluginKey: string;

  @Column({ type: "text", transformer: sealConfig })
  config: Record<string, unknown>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastSyncedError: string | null;
}
