import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { HookModule } from "#src/hook/hook.module.js";
import { AgentHook } from "../agent/agent.entity.js";
import { AgentHookController, HookConnectionController } from "./hook-connection.controller.js";
import { HookConnection } from "./hook-connection.entity.js";
import { AgentHookService, HookConnectionService } from "./hook-connection.service.js";
import { HookDispatcher } from "./hook.dispatcher.js";

@Module({
  imports: [TypeOrmModule.forFeature([HookConnection, AgentHook]), HookModule],
  controllers: [HookConnectionController, AgentHookController],
  providers: [HookConnectionService, AgentHookService, HookDispatcher],
  exports: [HookConnectionService, AgentHookService, HookDispatcher],
})
export class HookConnectionModule {}
