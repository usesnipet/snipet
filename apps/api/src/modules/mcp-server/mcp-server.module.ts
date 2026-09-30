import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { McpConnector } from "./mcp/connector.js";
import { McpServerController } from "./mcp-server.controller.js";
import { McpServer } from "./mcp-server.entity.js";
import { McpServerService } from "./mcp-server.service.js";
import { MCP_SYNC_QUEUE, McpServerSyncProcessor } from "./mcp-server.sync.processor.js";
import { McpServerSyncService } from "./mcp-server.sync.service.js";
import { Tool } from "../tool/tool.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([McpServer, Tool]), BullModule.registerQueue({ name: MCP_SYNC_QUEUE })],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerSyncService, McpServerSyncProcessor, McpConnector],
  exports: [McpServerService, McpConnector],
})
export class McpServerModule {}
