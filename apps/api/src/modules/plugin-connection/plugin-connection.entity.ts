import type { JsonObject, PluginAuthStatus, PluginConnection as PluginConnectionContract } from "@snipet/shared";
import type { OAuth2Credentials } from "#src/core/manifest/oauth2.js";
import type { DiscoveredProvider, RegisteredClient } from "#src/infra/oauth2/discovery.js";
import { sealConfig } from "#src/infra/database/seal-config.js";
import { BaseEntity } from "@snipet/server-common";
import { LLMTool } from "@snipet/shared/core";
import { Column, Entity, Index } from "typeorm";

/** The provider found for an `oauth2_discovery` connection and the client it registered there. */
export interface DiscoveredOAuth2 {
  /** The resource URL it was found from; another one (the config changed) means discovering again. */
  resourceUrl: string;
  provider: DiscoveredProvider;
  client: RegisteredClient;
}

/** The OAuth tokens, plus the discovered provider and client they renew with. */
export type PluginConnectionCredentials = OAuth2Credentials & { discovered?: DiscoveredOAuth2 };

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

  /**
   * The OAuth tokens, sealed like `config` but kept apart from it: `config` is
   * what the user edits, these only come from the provider. `mask` drops them
   * (sets undefined) before a connection leaves the API.
   */
  @Column({ type: "text", nullable: true, transformer: sealConfig })
  credentials?: PluginConnectionCredentials | null;

  /** Not stored: filled by `PluginConnectionService.mask` from the manifest and `credentials`. */
  authStatus: PluginAuthStatus;

  /** What the tools driver listed on the last sync. Only loaded on request: it would weigh down every listing. */
  @Column({ type: "jsonb", default: [], select: false })
  tools: LLMTool[];

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
