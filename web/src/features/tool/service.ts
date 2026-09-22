import http from "@/lib/http";

import { listToolsSearchParamsSchema, paginatedToolSchema, toolSchema } from "./schemas";

import type {
  ListToolsSearchParams,
  PaginatedTool,
  Tool,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
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

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${TOOL_URL}/{id}`,
    params: { id },
    ...opts,
  });

export const toolService = { list, findById, delete: remove };
