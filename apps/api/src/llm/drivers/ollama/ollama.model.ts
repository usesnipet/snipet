import { Driver } from "#src/manifest/driver.js";
import { LlmCapability } from "@snipet/shared";

import { ollamaClient, ollamaOptionsSchema, toLlmError } from "./ollama.client.js";

import type { LlmModel } from "@snipet/shared";
import type { ModelDriver } from "../../driver.js";
import type { OllamaOptions } from "./ollama.client.js";

export interface OllamaShow {
  capabilities?: string[];
  model_info?: Record<string, unknown>;
}

const CAPABILITIES: Record<string, LlmCapability> = {
  completion: LlmCapability.TEXT,
  tools: LlmCapability.TOOLS,
  vision: LlmCapability.VISION,
  embedding: LlmCapability.EMBEDDING,
};

export function toLlmModel(name: string, show: OllamaShow): LlmModel {
  const contextLength = Object.entries(show.model_info ?? {}).find(([k]) => k.endsWith(".context_length"))?.[1];
  return {
    key: name,
    name,
    description: "",
    capabilities: (show.capabilities ?? []).flatMap((c) => CAPABILITIES[c] ?? []),
    contextWindow: typeof contextLength === "number" ? contextLength : 0,
  };
}

/**
 * Lists models through Ollama's native api, which unlike /v1/models reports
 * capabilities and context length.
 */
export class OllamaModelDriver extends Driver(ollamaOptionsSchema) implements ModelDriver<OllamaOptions> {
  readonly key = "ollama";

  async listModels(options: OllamaOptions): Promise<LlmModel[]> {
    try {
      const client = ollamaClient(options, AbortSignal.timeout(10_000));
      const { models } = await client.list();
      return await Promise.all(
        models.map(async (m) => {
          // The SDK types model_info as a Map, but it arrives as plain JSON.
          const show = (await client.show({ model: m.name })) as unknown as OllamaShow;
          return toLlmModel(m.name, show);
        }),
      );
    } catch (err) {
      throw toLlmError(err);
    }
  }
}
