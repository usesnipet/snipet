import { http } from "@/lib/http";

import {
  apiKeySchema, apiKeyWithSecretSchema, createApiKeySchema,
  listApiKeySearchParamsSchema, paginatedApiKeySchema, updateApiKeyExpirationSchema
} from "./schemas";

import type {
  ApiKey, ApiKeyWithSecret, CreateApiKey, ListApiKeySearchParams, PaginatedApiKey,
  UpdateApiKeyExpiration
} from "./schemas";
import type {
  ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions
} from "@/lib/services";

const apiKeysUrl = () => "/api/api-keys";
const API_KEY_ME_URL = "/api/api-key/me";

const list = async (
  opts: ServiceGetOptions<PaginatedApiKey, ListApiKeySearchParams> = {},
): Promise<PaginatedApiKey> => {
  return http.get({
    url: apiKeysUrl(),
    schemas: {
      response: paginatedApiKeySchema,
      searchParams: listApiKeySearchParamsSchema,
    },
    ...opts,
  })
}

const create = async (
  body: CreateApiKey,
  opts: ServicePostOptions<CreateApiKey, ApiKeyWithSecret> = {},
): Promise<ApiKeyWithSecret> => {
  return http.post({
    url: apiKeysUrl(),
    body,
    schemas: {
      body: createApiKeySchema,
      response: apiKeyWithSecretSchema,
    },
    ...opts,
  })
}

const updateExpiration = async (
  id: string,
  body: UpdateApiKeyExpiration,
  opts: ServicePutOptions<UpdateApiKeyExpiration, void> = {},
): Promise<void> => {
  return http.put({
    url: `${apiKeysUrl()}/{id}/expiration`,
    params: { id },
    body,
    schemas: {
      body: updateApiKeyExpirationSchema,
    },
    ...opts,
  })
}

const me = async (opts: ServiceGetOptions<ApiKey> = {}): Promise<ApiKey> => {
  return http.get({
    url: API_KEY_ME_URL,
    schemas: { response: apiKeySchema },
    ...opts,
  })
}

const findById = async (
  id: string,
  opts: ServiceGetOptions<ApiKey> = {},
): Promise<ApiKey> => {
  return http.get({
    url: `${apiKeysUrl()}/{id}`,
    params: { id },
    schemas: { response: apiKeySchema },
    ...opts,
  })
}

const roll = async (
  id: string,
  opts: ServicePostOptions<undefined, ApiKeyWithSecret> = {},
): Promise<ApiKeyWithSecret> => {
  return http.post({
    url: `${apiKeysUrl()}/{id}/roll`,
    params: { id },
    schemas: {
      response: apiKeyWithSecretSchema,
    },
    ...opts,
  })
}

const remove = async (
  id: string,
  opts: ServiceDeleteOptions<void> = {},
): Promise<void> => {
  return http.delete({
    url: `${apiKeysUrl()}/{id}`,
    params: { id },
    ...opts,
  })
}

export const apiKeyService = {
  list,
  create,
  me,
  findById,
  roll,
  updateExpiration,
  delete: remove,
}
