import { PluginModule } from "#src/drivers/plugin/plugin.module.js";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { HookDispatcher } from "../../core/plugin/hooks/hook.dispatcher.js";
import { AgentRunner } from "../../core/run/agent.runner.js";
import { AgentContext } from "../../core/run/resolvers/context.resolver.js";
import { AgentMessage } from "../agent-session/agent-message.entity.js";
import { AgentSessionModule } from "../agent-session/agent-session.module.js";
import { AgentModule } from "../agent/agent.module.js";
import { LlmConnectionModule } from "../llm-connection/llm-connection.module.js";
import { PluginConnectionModule } from "../plugin-connection/plugin-connection.module.js";

import { AgentRunController } from "./agent-run.controller.js";
import { AgentRun } from "./agent-run.entity.js";
import { AgentRunService } from "./agent-run.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentRun, AgentMessage]),
    AgentModule,
    AgentSessionModule,
    LlmConnectionModule,
    PluginConnectionModule,
    PluginModule,
  ],
  controllers: [AgentRunController],
  providers: [AgentRunService, AgentRunner, AgentContext, HookDispatcher],
})
export class AgentRunModule {}
