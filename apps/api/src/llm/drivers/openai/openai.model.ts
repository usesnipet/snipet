import { Driver } from "#src/manifest/driver.js";
import { LlmCapability } from "@snipet/shared";

import { openAiClient, openAiOptionsSchema, toLlmError } from "./openai.client.js";

import type { LlmModel } from "@snipet/shared";
import type { ModelDriver } from "../../driver.js";
import type { OpenAiOptions } from "./openai.client.js";

export class OpenAiModelDriver extends Driver(openAiOptionsSchema) implements ModelDriver<OpenAiOptions> {
  readonly key = "openai";

  async listModels(options: OpenAiOptions): Promise<LlmModel[]> {
    try {
      const models: LlmModel[] = [];
      // The endpoint has no capability data, so every model is reported alike.
      for await (const m of openAiClient(options).models.list()) {
        models.push({
          key: m.id,
          name: m.id,
          description: "",
          capabilities: [LlmCapability.TEXT, LlmCapability.TOOLS],
          contextWindow: 0,
        });
      }
      return models;
    } catch (err) {
      throw toLlmError(err);
    }
  }
}
