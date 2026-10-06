import http from "../http";

import {
  createMcpServerSchema,
  findMcpServersParamsSchema,
  mcpServerRegistryItemSchema,
  mcpServerSchema,
  paginatedMcpServerSchema,
  updateMcpServerSchema,
} from "@snipet/shared";
import { z } from "zod";

import type {
  CreateMcpServer,
  FindMcpServersParams,
  McpServer,
  McpServerRegistryItem,
  Paginated,
  UpdateMcpServer,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";

const MCP_SERVER_URL = "/api/mcp-servers";

const list = async (
  opts: ServiceGetOptions<Paginated<McpServer>, Partial<FindMcpServersParams>> = {},
): Promise<Paginated<McpServer>> =>
  http.get({
    url: MCP_SERVER_URL,
    schemas: {
      response: paginatedMcpServerSchema,
      searchParams: findMcpServersParamsSchema,
    },
    ...opts,
  });

const findById = async (
  id: string,
  opts: ServiceGetOptions<McpServer> = {},
): Promise<McpServer> =>
  http.get({
    url: `${MCP_SERVER_URL}/{id}`,
    params: { id },
    schemas: { response: mcpServerSchema },
    ...opts,
  });

const create = async (
  body: CreateMcpServer,
  opts: ServicePostOptions<CreateMcpServer, McpServer> = {},
): Promise<McpServer> =>
  http.post({
    url: MCP_SERVER_URL,
    body,
    schemas: { body: createMcpServerSchema, response: mcpServerSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdateMcpServer,
  opts: ServicePutOptions<UpdateMcpServer, void> = {},
): Promise<void> =>
  http.put({
    url: `${MCP_SERVER_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateMcpServerSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${MCP_SERVER_URL}/{id}`,
    params: { id },
    ...opts,
  });

const listRegistry = async (
  opts: ServiceGetOptions<McpServerRegistryItem[]> = {},
): Promise<McpServerRegistryItem[]> =>
  http.get({
    url: `${MCP_SERVER_URL}/registry`,
    schemas: { response: z.array(mcpServerRegistryItemSchema) },
    ...opts,
  });

const findRegistryItem = async (
  key: string,
  opts: ServiceGetOptions<McpServerRegistryItem> = {},
): Promise<McpServerRegistryItem> =>
  http.get({
    url: `${MCP_SERVER_URL}/registry/{key}`,
    params: { key },
    schemas: { response: mcpServerRegistryItemSchema },
    ...opts,
  });

export const mcpServerService = {
  list,
  findById,
  create,
  update,
  delete: remove,
  listRegistry,
  findRegistryItem,
};
