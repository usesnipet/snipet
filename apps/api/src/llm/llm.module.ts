import { env } from "#src/env.js";
import { HttpHealthCheckDriver } from "#src/manifest/drivers/http.health.js";
import { Module } from "@nestjs/common";
import { llmManifestSchema } from "@snipet/shared";
import { resolve } from "node:path";

import { OpenAiChatDriver } from "./drivers/openai/openai.chat.js";
import { OpenAiModelDriver } from "./drivers/openai/openai.model.js";
import { StaticModelDriver } from "./drivers/static.model.js";
import { LLMDriverRegistry, LLMRegistry } from "./llm.registry.js";
import { LLMRunner } from "./llm.runner.js";

@Module({
  providers: [
    {
      provide: LLMDriverRegistry,
      useFactory: () =>
        new LLMDriverRegistry({
          chat: [new OpenAiChatDriver()],
          models: [new StaticModelDriver(), new OpenAiModelDriver()],
          healthCheck: [new HttpHealthCheckDriver()],
        }),
    },
    {
      provide: LLMRegistry,
      useFactory: (drivers: LLMDriverRegistry) =>
        new LLMRegistry("llm", env.LLMS_DIR, resolve(import.meta.dirname, "./manifests"), llmManifestSchema, drivers),
      inject: [LLMDriverRegistry],
    },
    LLMRunner,
  ],
  exports: [LLMDriverRegistry, LLMRegistry, LLMRunner],
})
export class LLMModule {}
