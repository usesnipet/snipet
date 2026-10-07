import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ToolSource } from "@snipet/shared";
import { Repository } from "typeorm";

import { CrudService, validateJson } from "@snipet/server-common";
import { McpConnector } from "../../infra/mcp/connector.js";
import { McpServerService } from "../mcp-server/mcp-server.service.js";

import { NativeToolService } from "./native-tool.service.js";
import { Tool } from "./tool.entity.js";

import type { ToolResult } from "@snipet/shared";

@Injectable()
export class ToolService extends CrudService<Tool> {
  constructor(
    @InjectRepository(Tool) repo: Repository<Tool>,
    private readonly servers: McpServerService,
    private readonly connector: McpConnector,
    private readonly native: NativeToolService,
  ) {
    super(repo);
  }

  // Failures the model can act on (bad arguments, unreachable server) come
  // back as an isError result; exceptions are for the caller's mistakes.
  async execute(id: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const tool = await this.findById(id);
    const native = tool.source === ToolSource.NATIVE;
    if (!native && (tool.source !== ToolSource.MCP || !tool.mcpServerId)) {
      throw new BadRequestException(`unsupported tool source "${tool.source}"`);
    }

    try {
      args = validateJson(tool.inputSchema, args);
    } catch (err) {
      return { content: `invalid arguments: ${describe(err)}`, isError: true };
    }

    if (native) {
      try {
        return { content: await this.native.run(tool.name, args), isError: false };
      } catch (err) {
        return { content: describe(err), isError: true };
      }
    }

    const server = await this.servers.findById(tool.mcpServerId!);
    try {
      return await this.connector.callTool(server.transport, server.config, tool.name, args);
    } catch (err) {
      return { content: describe(err), isError: true };
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof BadRequestException) return JSON.stringify(err.getResponse());
  return err instanceof Error ? err.message : String(err);
}
