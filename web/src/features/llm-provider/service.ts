import http from "@/lib/http";

import {
  createLlmProviderSchema,
  listLlmProvidersSearchParamsSchema,
  paginatedLlmProviderSchema,
  updateLlmProviderSchema,
  llmProviderSchema,
} from "./schemas";

import type {
  CreateLlmProvider,
  ListLlmProvidersSearchParams,
  PaginatedLlmProvider,
  UpdateLlmProvider,
  LlmProvider,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";

const LLM_PROVIDER_URL = "/api/llm-provider";

const list = async (
  opts: ServiceGetOptions<PaginatedLlmProvider, ListLlmProvidersSearchParams> = {},
): Promise<PaginatedLlmProvider> =>
  http.get({
    url: LLM_PROVIDER_URL,
    schemas: {
      response: paginatedLlmProviderSchema,
      searchParams: listLlmProvidersSearchParamsSchema,
    },
    ...opts,
  });

const findById = async (
  id: string,
  opts: ServiceGetOptions<LlmProvider> = {},
): Promise<LlmProvider> =>
  http.get({
    url: `${LLM_PROVIDER_URL}/{id}`,
    params: { id },
    schemas: { response: llmProviderSchema },
    ...opts,
  });

const create = async (
  body: CreateLlmProvider,
  opts: ServicePostOptions<CreateLlmProvider, LlmProvider> = {},
): Promise<LlmProvider> =>
  http.post({
    url: LLM_PROVIDER_URL,
    body,
    schemas: { body: createLlmProviderSchema, response: llmProviderSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdateLlmProvider,
  opts: ServicePutOptions<UpdateLlmProvider, void> = {},
): Promise<void> =>
  http.put({
    url: `${LLM_PROVIDER_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateLlmProviderSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${LLM_PROVIDER_URL}/{id}`,
    params: { id },
    ...opts,
  });

export const llmProviderService = { list, findById, create, update, delete: remove };
