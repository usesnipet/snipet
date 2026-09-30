import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LlmConnectionController } from "./llm-connection.controller.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([LlmConnection])],
  controllers: [LlmConnectionController],
  providers: [LlmConnectionService],
  exports: [LlmConnectionService],
})
export class LlmConnectionModule {}
