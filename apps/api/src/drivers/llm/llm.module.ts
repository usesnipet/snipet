import { LLMDriverRegistry, LLMManifestRegistry } from "#src/core/llm/llm.registry.js";
import { LLMRunner } from "#src/core/llm/llm.runner.js";
import { HttpHealthCheckDriver } from "#src/drivers/http.health.js";
import { env } from "#src/env.js";
import { loadManifests } from "#src/infra/manifest/load-manifest.js";
import { Logger, Module } from "@nestjs/common";
import { llmManifestSchema } from "@snipet/shared/core";
import { resolve } from "node:path";

import { OllamaChatDriver } from "./providers/ollama/ollama.chat.js";
import { OllamaModelDriver } from "./providers/ollama/ollama.model.js";
import { OpenAiChatDriver } from "./providers/openai/openai.chat.js";
import { OpenAiModelDriver } from "./providers/openai/openai.model.js";
import { StaticModelDriver } from "./providers/static/static.model.js";

@Module({
  providers: [
    {
      provide: LLMDriverRegistry,
      useFactory: () =>
        new LLMDriverRegistry({
          chat: [new OpenAiChatDriver(), new OllamaChatDriver()],
          models: [new StaticModelDriver(), new OpenAiModelDriver(), new OllamaModelDriver()],
          healthCheck: [new HttpHealthCheckDriver()],
        }),
    },
    {
      provide: LLMManifestRegistry,
      useFactory: async (drivers: LLMDriverRegistry) => {
        const registry = new LLMManifestRegistry(
          "llm",
          loadManifests([env.LLMS_DIR, resolve(import.meta.dirname, "./manifests")]),
          llmManifestSchema,
          drivers,
          new Logger("LLMManifestRegistry"),
        );
        await registry.init();
        return registry;
      },
      inject: [LLMDriverRegistry],
    },
    {
      provide: LLMRunner,
      useFactory: (llms: LLMManifestRegistry, drivers: LLMDriverRegistry) => new LLMRunner(llms, drivers),
      inject: [LLMManifestRegistry, LLMDriverRegistry],
    },
  ],
  exports: [LLMDriverRegistry, LLMManifestRegistry, LLMRunner],
})
export class LLMModule {}
