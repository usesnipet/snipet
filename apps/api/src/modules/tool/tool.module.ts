import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { McpModule } from "../../infra/mcp/mcp.module.js";
import { McpServerModule } from "../mcp-server/mcp-server.module.js";

import { ToolController } from "./tool.controller.js";
import { Tool } from "./tool.entity.js";
import { ToolService } from "./tool.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Tool]), McpModule, McpServerModule],
  controllers: [ToolController],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule {}
