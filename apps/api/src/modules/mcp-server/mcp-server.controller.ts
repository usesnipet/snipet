import { Controller, Get, Param } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController, Roles } from "@snipet/server-common";

import { createMcpServerSchema, findMcpServersSchema, updateMcpServerSchema } from "./mcp-server.dto.js";
import { McpServer } from "./mcp-server.entity.js";
import { McpServerService } from "./mcp-server.service.js";

// Admin only: MCP servers run arbitrary commands and URLs on the host and
// their config holds credentials.
@Roles(Role.Admin)
@Controller("mcp-servers")
export class McpServerController extends CrudController<McpServer>({
  create: createMcpServerSchema,
  update: updateMcpServerSchema,
  filter: findMcpServersSchema,
}) {
  constructor(override readonly service: McpServerService) {
    super(service);
  }

  @Get("registry")
  listRegistry() {
    return this.service.listRegistry();
  }

  @Get("registry/:key")
  getRegistryItem(@Param("key") key: string) {
    return this.service.getRegistryItem(key);
  }
}
