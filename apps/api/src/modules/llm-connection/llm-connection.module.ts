import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LlmConnectionController } from "./llm-connection.controller.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";
import { LlmRegistry } from "./llm/registry.js";
import { LlmRunner } from "./llm/runner.js";
import { OllamaProvider } from "./providers/ollama/ollama.provider.js";
import { OpenAiProvider } from "./providers/openai/openai.provider.js";

@Module({
  imports: [TypeOrmModule.forFeature([LlmConnection])],
  controllers: [LlmConnectionController],
  providers: [
    LlmConnectionService,
    { provide: LlmRegistry, useFactory: () => new LlmRegistry([new OpenAiProvider(), new OllamaProvider()]) },
    { provide: LlmRunner, useFactory: (registry: LlmRegistry) => new LlmRunner(registry), inject: [LlmRegistry] },
  ],
  exports: [LlmConnectionService, LlmRunner],
})
export class LlmConnectionModule {}
