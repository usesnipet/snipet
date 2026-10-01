import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { McpModule } from "../../infra/mcp/mcp.module.js";
import { McpServerController } from "./mcp-server.controller.js";
import { McpServer } from "./mcp-server.entity.js";
import { McpServerService } from "./mcp-server.service.js";
import { MCP_SYNC_QUEUE, McpServerSyncProcessor } from "./queue/mcp-server-sync.processor.js";
import { McpServerSyncService } from "./queue/mcp-server-sync.service.js";
import { Tool } from "../tool/tool.entity.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([McpServer, Tool]),
    BullModule.registerQueue({ name: MCP_SYNC_QUEUE }),
    BullBoardModule.forFeature({ name: MCP_SYNC_QUEUE, adapter: BullMQAdapter }),
    McpModule,
  ],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerSyncService, McpServerSyncProcessor],
  exports: [McpServerService],
})
export class McpServerModule {}
