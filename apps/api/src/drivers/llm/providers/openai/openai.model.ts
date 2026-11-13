import { Driver } from "#src/core/manifest/driver.js";
import { LLMCapability } from "@snipet/shared/core";
import type { LLMModel } from "@snipet/shared/core";

import { openAiClient, openAiOptionsSchema, toLlmError } from "./openai.client.js";

import type { ModelDriver } from "#src/core/llm/driver.js";
import type { OpenAiOptions } from "./openai.client.js";

export class OpenAiModelDriver extends Driver(openAiOptionsSchema) implements ModelDriver<OpenAiOptions> {
  readonly key = "openai";

  async listModels(options: OpenAiOptions): Promise<LLMModel[]> {
    try {
      const models: LLMModel[] = [];
      // The endpoint has no capability data, so every model is reported alike.
      for await (const m of openAiClient(options).models.list()) {
        models.push({
          key: m.id,
          name: m.id,
          description: "",
          capabilities: [LLMCapability.TEXT, LLMCapability.TOOLS],
          contextWindow: 0,
        });
      }
      return models;
    } catch (err) {
      throw toLlmError(err);
    }
  }
}
