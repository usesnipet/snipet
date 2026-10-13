import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PluginModule } from "../../infra/plugin/plugin.module.js";
import { PluginAction } from "./plugin-action.entity.js";
import { PluginConnectionController } from "./plugin-connection.controller.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionService } from "./plugin-connection.service.js";
import { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([PluginConnection, PluginAction]), PluginModule],
  controllers: [PluginConnectionController],
  providers: [PluginConnectionService, PluginConnectionSyncService],
  exports: [PluginConnectionService],
})
export class PluginConnectionModule {}
