import type { JsonObject, PluginConnection as PluginConnectionContract } from "@snipet/shared";
import { sealConfig } from "#src/manifest/seal-config.js";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, Index } from "typeorm";

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
  config: JsonObject;

  @Column({ default: true })
  enabled: boolean;

  /** What the instructions driver returned on the last sync. */
  @Column({ type: "text", nullable: true })
  instructions: string | null;

  /** Replaces `instructions` when set. */
  @Column({ type: "text", nullable: true })
  customInstructions: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastSyncedError: string | null;
}
