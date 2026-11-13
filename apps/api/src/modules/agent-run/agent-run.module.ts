import { CoreModule } from "#src/core-module/core.module.js";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AgentMessage } from "../agent-session/agent-message.entity.js";
import { AgentSessionModule } from "../agent-session/agent-session.module.js";
import { AgentModule } from "../agent/agent.module.js";

import { AgentRunController } from "./agent-run.controller.js";
import { AgentRun } from "./agent-run.entity.js";
import { AgentRunService } from "./agent-run.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AgentRun, AgentMessage]), AgentModule, AgentSessionModule, CoreModule],
  controllers: [AgentRunController],
  providers: [AgentRunService],
})
export class AgentRunModule {}
