import type { JsonObject } from "@snipet/shared";
import type { LLMTool } from "@snipet/shared/core";
import type { CoreContext } from "../context.js";
import type { ConnectionAuth } from "../manifest/options.js";

/** A plugin connection as a run uses it. */
export interface RunPluginConnection {
  id: string;
  name: string;
  pluginKey: string;
  /** Unsealed: holds secrets, never log it. */
  config: JsonObject;
  /** The OAuth token, renewed if it was about to expire; absent when the plugin has no OAuth. Secret. */
  auth?: ConnectionAuth;
  /** What the tools driver listed on the last sync. */
  tools: LLMTool[];
  /** The user's custom instructions over the driver's; null when there are none. */
  instructions: string | null;
}

/** Where a run reads the plugin connections its agent was granted. */
export abstract class PluginConnectionStore {
  /**
   * The enabled connections among `ids`, by id; missing or disabled ones
   * aren't in the map, nor OAuth ones without a usable token.
   */
  abstract findEnabled(ctx: CoreContext, ids: string[]): Promise<Map<string, RunPluginConnection>>;
}
