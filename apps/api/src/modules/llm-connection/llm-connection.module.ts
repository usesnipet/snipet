import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LLMModule } from "#src/llm/llm.module.js";

import { LlmConnectionController } from "./llm-connection.controller.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";
import { LlmModel } from "./llm-model.entity.js";
import { LlmConnectionSyncService } from "./sync/llm-connection-sync.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([LlmConnection, LlmModel]), LLMModule],
  controllers: [LlmConnectionController],
  providers: [LlmConnectionService, LlmConnectionSyncService],
  exports: [LlmConnectionService, LLMModule],
})
export class LlmConnectionModule {}
