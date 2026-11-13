import type { JsonObject } from "@snipet/shared";
import type { CoreContext } from "../context.js";

/** An LLM connection as a run uses it. */
export interface RunLLMConnection {
  id: string;
  llmKey: string;
  /** Unsealed: holds secrets, never log it. */
  config: JsonObject;
  /** Keys of the models the models driver listed on the last sync. */
  models: string[];
}

/** Where a run reads the LLM connections its agent's models are on. */
export abstract class LLMConnectionStore {
  /** The connections among `ids`, by id; missing ones aren't in the map. */
  abstract findByIds(ctx: CoreContext, ids: string[]): Promise<Map<string, RunLLMConnection>>;
}
