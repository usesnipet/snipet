import http from "@/lib/http";

import {
  executeToolResponseSchema,
  executeToolSchema,
  listToolsSearchParamsSchema,
  paginatedToolSchema,
  toolSchema,
} from "./schemas";

import type {
  ExecuteTool,
  ExecuteToolResponse,
  ListToolsSearchParams,
  PaginatedTool,
  Tool,
} from "./schemas";
import type {
  ServiceGetOptions,
  ServicePostOptions,
} from "@/lib/services";

const TOOL_URL = "/api/tool";

const list = async (
  opts: ServiceGetOptions<PaginatedTool, ListToolsSearchParams> = {},
): Promise<PaginatedTool> =>
  http.get({
    url: TOOL_URL,
    schemas: {
      response: paginatedToolSchema,
      searchParams: listToolsSearchParamsSchema,
    },
    ...opts,
  });

const findById = async (
  id: string,
  opts: ServiceGetOptions<Tool> = {},
): Promise<Tool> =>
  http.get({
    url: `${TOOL_URL}/{id}`,
    params: { id },
    schemas: { response: toolSchema },
    ...opts,
  });

const execute = async (
  id: string,
  body: ExecuteTool,
  opts: ServicePostOptions<ExecuteTool, ExecuteToolResponse> = {},
): Promise<ExecuteToolResponse> =>
  http.post({
    url: `${TOOL_URL}/{id}/execute`,
    params: { id },
    body,
    schemas: { body: executeToolSchema, response: executeToolResponseSchema },
    ...opts,
  });

export const toolService = { list, findById, execute };
