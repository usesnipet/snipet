import { Module } from "@nestjs/common";

import { OllamaProvider } from "./providers/ollama/ollama.provider.js";
import { OpenAiProvider } from "./providers/openai/openai.provider.js";
import { LlmRegistry } from "./registry.js";
import { LlmRunner } from "./runner.js";

@Module({
  providers: [
    { provide: LlmRegistry, useFactory: () => new LlmRegistry([new OpenAiProvider(), new OllamaProvider()]) },
    { provide: LlmRunner, useFactory: (registry: LlmRegistry) => new LlmRunner(registry), inject: [LlmRegistry] },
  ],
  exports: [LlmRegistry, LlmRunner],
})
export class LlmModule {}
