import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { McpConnector } from "./mcp/connector.js";
import { McpServerController } from "./mcp-server.controller.js";
import { McpServer } from "./mcp-server.entity.js";
import { McpServerService } from "./mcp-server.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([McpServer])],
  controllers: [McpServerController],
  providers: [McpServerService, McpConnector],
  exports: [McpServerService, McpConnector],
})
export class McpServerModule {}
