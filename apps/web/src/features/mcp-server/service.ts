import http from "@/lib/http";

import {
  createMcpServerSchema,
  listMcpServerRegistrySchema,
  listMcpServersSearchParamsSchema,
  mcpServerRegistryItemSchema,
  paginatedMcpServerSchema,
  updateMcpServerSchema,
  mcpServerSchema,
} from "./schemas";

import type {
  CreateMcpServer,
  ListMcpServerRegistry,
  ListMcpServersSearchParams,
  McpServerRegistryItem,
  PaginatedMcpServer,
  UpdateMcpServer,
  McpServer,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";

const MCP_SERVER_URL = "/api/mcp-server";

const list = async (
  opts: ServiceGetOptions<PaginatedMcpServer, ListMcpServersSearchParams> = {},
): Promise<PaginatedMcpServer> =>
  http.get({
    url: MCP_SERVER_URL,
    schemas: {
      response: paginatedMcpServerSchema,
      searchParams: listMcpServersSearchParamsSchema,
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
  opts: ServiceGetOptions<ListMcpServerRegistry> = {},
): Promise<ListMcpServerRegistry> =>
  http.get({
    url: `${MCP_SERVER_URL}/registry`,
    schemas: { response: listMcpServerRegistrySchema },
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
