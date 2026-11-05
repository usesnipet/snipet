import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { FilesModule } from "../files/files.module.js";
import { PluginConnectionModule } from "../plugin-connection/plugin-connection.module.js";

import { AgentController } from "./agent.controller.js";
import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentLlm, AgentPluginConnection]), FilesModule, PluginConnectionModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
