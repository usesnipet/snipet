import { Driver } from "#src/core/manifest/driver.js";
import { LlmModel, llmModelSchema } from "@snipet/shared";
import z from "zod";

import type { ModelDriver } from "#src/core/llm/driver.js";

const optionsSchema = z.strictObject({
  models: z.array(llmModelSchema).min(1),
});
type StaticModelOptions = z.infer<typeof optionsSchema>;

export class StaticModelDriver extends Driver(optionsSchema) implements ModelDriver<StaticModelOptions> {
  readonly key = "static";

  listModels(options: StaticModelOptions): Promise<LlmModel[]> {
    return Promise.resolve(options.models);
  }
}
