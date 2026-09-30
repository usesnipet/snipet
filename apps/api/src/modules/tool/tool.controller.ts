import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { executeToolSchema, Role } from "@snipet/shared";

import { Roles } from "../../common/decorators/auth.decorators.js";
import { ZodPipe } from "../../common/pipes/zod.pipe.js";

import { findToolsSchema } from "./tool.dto.js";
import { ToolService } from "./tool.service.js";

import type { FilterQuery } from "../../common/pagination/filter.js";
import type { Tool } from "./tool.entity.js";
import type { ExecuteTool } from "@snipet/shared";

// Read-only: tools come from MCP server syncs. Admin only, since executing
// acts on the host through the MCP server and tools embed its config.
@Roles(Role.Admin)
@Controller("tools")
export class ToolController {
  constructor(private readonly service: ToolService) {}

  @Get()
  filter(@Query(new ZodPipe(findToolsSchema)) query: FilterQuery<Tool>) {
    return this.service.filter(query);
  }

  @Get(":id")
  findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post(":id/execute")
  @HttpCode(200)
  execute(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(executeToolSchema)) dto: ExecuteTool) {
    return this.service.execute(id, dto.arguments);
  }
}
