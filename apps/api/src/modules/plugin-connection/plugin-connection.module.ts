import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PluginModule } from "#src/drivers/plugin/plugin.module.js";
import { PluginConnectionController } from "./plugin-connection.controller.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { OAuthController } from "./plugin-connection.oauth.controller.js";
import { PluginConnectionOAuthService } from "./plugin-connection.oauth.service.js";
import { PluginConnectionTokenService } from "./plugin-connection.token.service.js";
import { PluginConnectionService } from "./plugin-connection.service.js";
import { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([PluginConnection]), PluginModule],
  controllers: [PluginConnectionController, OAuthController],
  providers: [
    PluginConnectionService,
    PluginConnectionOAuthService,
    PluginConnectionSyncService,
    PluginConnectionTokenService,
  ],
  exports: [PluginConnectionService, PluginConnectionTokenService],
})
export class PluginConnectionModule {}
