import http, { httpSse } from "../http";

import {
  createLlmConnectionSchema,
  executeLlmSchema,
  findLlmConnectionsParamsSchema,
  listProviderModelsParamsSchema,
  llmConnectionSchema,
  llmModelSchema,
  llmProviderInfoSchema,
  llmResponseSchema,
  llmStreamEventSchema,
  paginatedLlmConnectionSchema,
  updateLlmConnectionSchema,
} from "@snipet/shared";
import { z } from "zod";

import type {
  CreateLlmConnection,
  ExecuteLlm,
  FindLlmConnectionsParams,
  ListProviderModelsParams,
  LlmConnection,
  LlmModel,
  LlmProviderInfo,
  LlmResponse,
  LlmStreamEvent,
  Paginated,
  UpdateLlmConnection,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";

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
  opts: ServiceGetOptions<LlmProviderInfo[]> = {},
): Promise<LlmProviderInfo[]> =>
  http.get({
    url: `${LLM_CONNECTION_URL}/providers`,
    schemas: { response: z.array(llmProviderInfoSchema) },
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

// listProviderModels sources connection options from searchParams.connectionId
// when given, else providerKey's default connection (backend-resolved).
const listProviderModels = async (
  providerKey: string,
  opts: ServiceGetOptions<LlmModel[], ListProviderModelsParams> = {},
): Promise<LlmModel[]> =>
  http.get({
    url: `${LLM_CONNECTION_URL}/providers/{key}/models`,
    params: { key: providerKey },
    schemas: {
      response: z.array(llmModelSchema),
      searchParams: listProviderModelsParamsSchema,
    },
    ...opts,
  });

const execute = async (
  body: ExecuteLlm,
  opts: ServicePostOptions<ExecuteLlm, LlmResponse> = {},
): Promise<LlmResponse> =>
  http.post({
    url: `${LLM_CONNECTION_URL}/execute`,
    body,
    schemas: { body: executeLlmSchema, response: llmResponseSchema },
    ...opts,
  });

// executeStream runs the streamed variant, invoking onEvent with each typed
// SSE event (llm_started, text_delta, tool_call, llm_skipped, message, error, done).
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
      const parsed = llmStreamEventSchema.safeParse({ event, data });
      if (parsed.success) onEvent(parsed.data);
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
