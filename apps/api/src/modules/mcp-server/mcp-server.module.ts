import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { McpModule } from "../../infra/mcp/mcp.module.js";
import { McpServerController } from "./mcp-server.controller.js";
import { McpServer } from "./mcp-server.entity.js";
import { McpServerService } from "./mcp-server.service.js";
import { McpServerSyncService } from "./sync/mcp-server-sync.service.js";
import { Tool } from "../tool/tool.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([McpServer, Tool]), McpModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerSyncService],
  exports: [McpServerService],
})
export class McpServerModule {}
