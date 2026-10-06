import http from "../http";
import { executeToolSchema, findToolsParamsSchema, paginatedToolSchema, toolResultSchema, toolSchema } from "@snipet/shared";

import type { ExecuteTool, FindToolsParams, Paginated, Tool, ToolResult } from "@snipet/shared";
import type { ServiceGetOptions, ServicePostOptions } from "../http";

const TOOL_URL = "/api/tools";

const list = async (
  opts: ServiceGetOptions<Paginated<Tool>, Partial<FindToolsParams>> = {},
): Promise<Paginated<Tool>> =>
  http.get({
    url: TOOL_URL,
    schemas: {
      response: paginatedToolSchema,
      searchParams: findToolsParamsSchema,
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
  opts: ServicePostOptions<ExecuteTool, ToolResult> = {},
): Promise<ToolResult> =>
  http.post({
    url: `${TOOL_URL}/{id}/execute`,
    params: { id },
    body,
    schemas: { body: executeToolSchema, response: toolResultSchema },
    ...opts,
  });

export const toolService = { list, findById, execute };
