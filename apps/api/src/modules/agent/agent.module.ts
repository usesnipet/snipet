import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { StorageModule } from "#src/infra/storage/storage.module.js";

import { AgentController } from "./agent.controller.js";
import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentLlm, AgentPluginConnection]), StorageModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
