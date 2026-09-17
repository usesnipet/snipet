import http, { httpSse } from "@/lib/http";

import {
  createLlmConnectionSchema,
  executeLlmSchema,
  executeLlmResponseSchema,
  listLlmConnectionsSearchParamsSchema,
  listLlmProviderSchema,
  listProviderModelsSchema,
  listProviderModelsSearchParamsSchema,
  llmStreamErrorEventSchema,
  llmStreamDoneEventSchema,
  llmTextDeltaEventSchema,
  llmToolCallEventSchema,
  paginatedLlmConnectionSchema,
  updateLlmConnectionSchema,
  llmConnectionSchema,
} from "./schemas";

import type {
  CreateLlmConnection,
  ExecuteLlm,
  ExecuteLlmResponse,
  ListLlmConnectionsSearchParams,
  ListLlmProvider,
  ListProviderModels,
  ListProviderModelsSearchParams,
  LlmStreamEvent,
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

// listProviderModels sources connection options from searchParams.connection_id
// when given, else providerKey's default connection (backend-resolved).
const listProviderModels = async (
  providerKey: string,
  opts: ServiceGetOptions<ListProviderModels, ListProviderModelsSearchParams> = {},
): Promise<ListProviderModels> =>
  http.get({
    url: `${LLM_CONNECTION_URL}/providers/{key}/models`,
    params: { key: providerKey },
    schemas: {
      response: listProviderModelsSchema,
      searchParams: listProviderModelsSearchParamsSchema,
    },
    ...opts,
  });

const execute = async (
  body: ExecuteLlm,
  opts: ServicePostOptions<ExecuteLlm, ExecuteLlmResponse> = {},
): Promise<ExecuteLlmResponse> =>
  http.post({
    url: `${LLM_CONNECTION_URL}/execute`,
    body,
    schemas: { body: executeLlmSchema, response: executeLlmResponseSchema },
    ...opts,
  });

// executeStream runs the streamed variant, invoking onEvent with each typed
// SSE event ("text_delta" | "tool_call" | "error" | "done") as it arrives.
const executeStream = async (
  body: ExecuteLlm,
  onEvent: (event: LlmStreamEvent) => void,
  opts: { signal?: AbortSignal } = {},
): Promise<void> =>
  httpSse({
    url: `${LLM_CONNECTION_URL}/execute/stream`,
    body,
    schemas: { body: executeLlmSchema },
    signal: opts.signal,
    onEvent: (event, data) => {
      switch (event) {
        case "text_delta":
          onEvent({ event: "text_delta", data: llmTextDeltaEventSchema.parse(data) });
          return;
        case "tool_call":
          onEvent({ event: "tool_call", data: llmToolCallEventSchema.parse(data) });
          return;
        case "error":
          onEvent({ event: "error", data: llmStreamErrorEventSchema.parse(data) });
          return;
        case "done":
          onEvent({ event: "done", data: llmStreamDoneEventSchema.parse(data) });
          return;
      }
    },
  });

export const llmConnectionService = {
  list,
  listProviders,
  listProviderModels,
  findById,
  create,
  update,
  delete: remove,
  execute,
  executeStream,
};
