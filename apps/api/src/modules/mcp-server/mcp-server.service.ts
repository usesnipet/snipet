import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { mcpConfigSchemas } from "@snipet/shared";
import { Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";

import { McpServer } from "./mcp-server.entity.js";
import { McpServerSyncService } from "./mcp-server.sync.service.js";
import { MCP_SERVERS_REGISTRY } from "./mcp/registry.js";

import type { CreateMcpServer, McpServerRegistryItem, McpTransport, UpdateMcpServer } from "@snipet/shared";

@Injectable()
export class McpServerService extends CrudService<McpServer> {
  constructor(
    @InjectRepository(McpServer) repo: Repository<McpServer>,
    private readonly sync: McpServerSyncService,
  ) {
    super(repo);
  }

  override async create(dto: CreateMcpServer): Promise<McpServer> {
    validateConfig(dto.transport, dto.config);
    const server = await super.create(dto);
    this.sync.enqueue(server.id);
    return server;
  }

  // config is checked against the resulting transport, stored or new.
  override async updateById(id: string, dto: UpdateMcpServer): Promise<void> {
    if (dto.transport !== undefined || dto.config !== undefined) {
      const existing = await this.findById(id);
      validateConfig(dto.transport ?? existing.transport, dto.config ?? existing.config);
    }
    await super.updateById(id, dto);
    if (dto.transport !== undefined || dto.config !== undefined) this.sync.enqueue(id);
  }

  listRegistry(): McpServerRegistryItem[] {
    return MCP_SERVERS_REGISTRY;
  }

  getRegistryItem(key: string): McpServerRegistryItem {
    const item = MCP_SERVERS_REGISTRY.find((i) => i.key === key);
    if (!item) throw new NotFoundException("mcp server registry item not found");
    return item;
  }
}

function validateConfig(transport: McpTransport, config: unknown) {
  const result = mcpConfigSchemas[transport].safeParse(config);
  if (!result.success) {
    throw new BadRequestException({ message: "invalid config", details: result.error.issues });
  }
}
