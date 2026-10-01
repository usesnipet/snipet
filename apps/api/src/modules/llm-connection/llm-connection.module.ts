import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LlmModule } from "../../infra/llm/llm.module.js";

import { LlmConnectionController } from "./llm-connection.controller.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([LlmConnection]), LlmModule],
  controllers: [LlmConnectionController],
  providers: [LlmConnectionService],
  exports: [LlmConnectionService, LlmModule],
})
export class LlmConnectionModule {}
