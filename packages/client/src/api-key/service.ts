import { http } from "../http";
import {
  apiKeySchema, apiKeyWithSecretSchema, createApiKeySchema, findApiKeysParamsSchema, paginatedApiKeySchema,
  updateApiKeySchema
} from "@snipet/shared";

import type {
  ApiKey, ApiKeyWithSecret, CreateApiKey, FindApiKeysParams, Paginated, UpdateApiKey
} from "@snipet/shared";
import type {
  ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions
} from "../http";

const apiKeysUrl = () => "/api/api-keys";
const API_KEY_ME_URL = "/api/api-key/me";

const list = async (
  opts: ServiceGetOptions<Paginated<ApiKey>, FindApiKeysParams> = {},
): Promise<Paginated<ApiKey>> => {
  return http.get({
    url: apiKeysUrl(),
    schemas: {
      response: paginatedApiKeySchema,
      searchParams: findApiKeysParamsSchema,
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

const update = async (
  id: string,
  body: UpdateApiKey,
  opts: ServicePutOptions<UpdateApiKey, void> = {},
): Promise<void> => {
  return http.put({
    url: `${apiKeysUrl()}/{id}`,
    params: { id },
    body,
    schemas: {
      body: updateApiKeySchema,
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
  update,
  delete: remove,
}
