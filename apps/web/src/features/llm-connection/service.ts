import http, { httpSse } from "@/lib/http";

import {
  executeLlmSchema,
  executeLlmResponseSchema,
  listLlmProviderSchema,
  listProviderModelsSchema,
  listProviderModelsSearchParamsSchema,
  llmStartEventSchema,
  llmStreamErrorEventSchema,
  llmStreamDoneEventSchema,
  llmSkippedEventSchema,
  llmMessageEventSchema,
  llmTextDeltaEventSchema,
  llmToolCallEventSchema,
} from "./schemas";
import {
  createLlmConnectionSchema,
  findLlmConnectionsParamsSchema,
  llmConnectionSchema,
  paginatedLlmConnectionSchema,
  updateLlmConnectionSchema,
} from "@snipet/shared";

import type {
  ExecuteLlm,
  ExecuteLlmResponse,
  ListLlmProvider,
  ListProviderModels,
  ListProviderModelsSearchParams,
  LlmStreamEvent,
} from "./schemas";
import type {
  CreateLlmConnection,
  FindLlmConnectionsParams,
  LlmConnection,
  Paginated,
  UpdateLlmConnection,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";

const LLM_CONNECTION_URL = "/api/llm-connections";

const list = async (
  opts: ServiceGetOptions<Paginated<LlmConnection>, FindLlmConnectionsParams> = {},
): Promise<Paginated<LlmConnection>> =>
  http.get({
    url: LLM_CONNECTION_URL,
    schemas: {
      response: paginatedLlmConnectionSchema,
      searchParams: findLlmConnectionsParamsSchema,
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
        case "llm_started":
          onEvent({ event: "llm_started", data: llmStartEventSchema.parse(data) });
          return;
        case "text_delta":
          onEvent({ event: "text_delta", data: llmTextDeltaEventSchema.parse(data) });
          return;
        case "tool_call":
          onEvent({ event: "tool_call", data: llmToolCallEventSchema.parse(data) });
          return;
        case "llm_skipped":
          onEvent({ event: "llm_skipped", data: llmSkippedEventSchema.parse(data) });
          return;
        case "message":
          onEvent({ event: "message", data: llmMessageEventSchema.parse(data) });
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
