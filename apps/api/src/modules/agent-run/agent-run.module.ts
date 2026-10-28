import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AgentModule } from "../agent/agent.module.js";
import { HookConnectionModule } from "../hook-connection/hook-connection.module.js";
import { LlmConnectionModule } from "../llm-connection/llm-connection.module.js";
import { PluginConnectionModule } from "../plugin-connection/plugin-connection.module.js";

import { AgentRunController } from "./agent-run.controller.js";
import { AgentMessage, AgentRun, AgentSession } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";
import { AgentRunner } from "./agent-run.runner.js";
import { AgentRunService } from "./agent-run.service.js";
import { AgentContext } from "./agent-context.js";
import { AgentSessionController } from "./agent-session.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentSession, AgentRun, AgentMessage]),
    AgentModule,
    HookConnectionModule,
    LlmConnectionModule,
    PluginConnectionModule,
  ],
  controllers: [AgentRunController, AgentSessionController],
  providers: [AgentRunService, AgentRunner, AgentRunEvents, AgentContext],
})
export class AgentRunModule {}
