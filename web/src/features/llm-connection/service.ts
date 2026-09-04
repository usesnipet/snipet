import http from "@/lib/http";

import {
  createLlmConnectionSchema,
  listLlmConnectionsSearchParamsSchema,
  listLlmProviderSchema,
  paginatedLlmConnectionSchema,
  updateLlmConnectionSchema,
  llmConnectionSchema,
} from "./schemas";

import type {
  CreateLlmConnection,
  ListLlmConnectionsSearchParams,
  ListLlmProvider,
  PaginatedLlmConnection,
  UpdateLlmConnection,
  LlmConnection,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";

const LLM_CONNECTION_URL = "/api/llm-connection";

const list = async (
  opts: ServiceGetOptions<PaginatedLlmConnection, ListLlmConnectionsSearchParams> = {},
): Promise<PaginatedLlmConnection> =>
  http.get({
    url: LLM_CONNECTION_URL,
    schemas: {
      response: paginatedLlmConnectionSchema,
      searchParams: listLlmConnectionsSearchParamsSchema,
    },
    ...opts,
  });

const listProviders = async (
  opts: ServiceGetOptions<ListLlmProvider> = {},
): Promise<ListLlmProvider> =>
  http.get({
    url: `${LLM_CONNECTION_URL}/providers`,
    schemas: { response: listLlmProviderSchema },
    ...opts,
  });

const findById = async (
  id: string,
  opts: ServiceGetOptions<LlmConnection> = {},
): Promise<LlmConnection> =>
  http.get({
    url: `${LLM_CONNECTION_URL}/{id}`,
    params: { id },
    schemas: { response: llmConnectionSchema },
    ...opts,
  });

const create = async (
  body: CreateLlmConnection,
  opts: ServicePostOptions<CreateLlmConnection, LlmConnection> = {},
): Promise<LlmConnection> =>
  http.post({
    url: LLM_CONNECTION_URL,
    body,
    schemas: { body: createLlmConnectionSchema, response: llmConnectionSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdateLlmConnection,
  opts: ServicePutOptions<UpdateLlmConnection, void> = {},
): Promise<void> =>
  http.put({
    url: `${LLM_CONNECTION_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateLlmConnectionSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${LLM_CONNECTION_URL}/{id}`,
    params: { id },
    ...opts,
  });

export const llmConnectionService = {
  list,
  listProviders,
  findById,
  create,
  update,
  delete: remove,
};
