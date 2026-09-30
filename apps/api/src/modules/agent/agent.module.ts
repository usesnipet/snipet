import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AgentController } from "./agent.controller.js";
import { Agent, AgentLlm, AgentMcpServer } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentLlm, AgentMcpServer])],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
