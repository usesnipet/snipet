import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiKeyService } from "./service";

import type {
  ApiKey, ApiKeyWithSecret, CreateApiKey, FindApiKeysParams, Paginated, UpdateApiKey
} from "@snipet/shared";
import type {
  ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions
} from "../http";
import type { QueryClient, UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "api-key";

export const listApiKeyQueryKey = () => [BASE_QUERY_KEY, "list"] as const;
export const useListApiKey = (
  opts?: ServiceGetOptions<Paginated<ApiKey>, FindApiKeysParams>
): UseQueryResult<Paginated<ApiKey>, Error> => {
  return useQuery({
    queryKey: [...listApiKeyQueryKey(), opts?.searchParams],
    queryFn: () => apiKeyService.list(opts),
  })
}

export const createApiKeyQueryKey = () => [BASE_QUERY_KEY, "create"];
export const useCreateApiKey = (
  opts?: ServicePostOptions<CreateApiKey, ApiKeyWithSecret>
): UseMutationResult<ApiKeyWithSecret, Error, { data: CreateApiKey }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: createApiKeyQueryKey(),
    mutationFn: ({ data }: { data: CreateApiKey }) =>
      apiKeyService.create(data, opts),
    meta: { successMessage: "API Key created successfully", errorMessage: "Failed to create API Key" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() }),
  })
}

export const meApiKeyQueryKey = () => [BASE_QUERY_KEY, "me"];
export const useMeApiKey = (
  opts?: ServiceGetOptions<ApiKey>
): UseQueryResult<ApiKey, Error> => {
  return useQuery({
    queryKey: meApiKeyQueryKey(),
    queryFn: (): Promise<ApiKey> =>
      apiKeyService.me(opts),
  })
}

export const findByIdApiKeyQueryKey = (id: string) =>
  [BASE_QUERY_KEY, "findById", id];
export const useFindByIdApiKey = (
  id: string,
  opts?: ServiceGetOptions<ApiKey>
): UseQueryResult<ApiKey, Error> => {
  return useQuery({
    queryKey: findByIdApiKeyQueryKey(id),
    queryFn: (): Promise<ApiKey> =>
      apiKeyService.findById(id, opts),
    enabled: !!id,
  })
}

// invalidateApiKey refreshes every cached view of one key after a write.
const invalidateApiKey = (queryClient: QueryClient, id: string) => {
  queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
  queryClient.invalidateQueries({ queryKey: meApiKeyQueryKey() });
  queryClient.invalidateQueries({ queryKey: findByIdApiKeyQueryKey(id) });
};

export const rollApiKeyQueryKey = () => [BASE_QUERY_KEY, "roll"];
export const useRollApiKey = (
  opts?: ServicePostOptions<undefined, ApiKeyWithSecret>
): UseMutationResult<ApiKeyWithSecret, Error, { id: string }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: rollApiKeyQueryKey(),
    mutationFn: ({ id }: { id: string }) =>
      apiKeyService.roll(id, opts),
    meta: { successMessage: "API Key rolled successfully", errorMessage: "Failed to roll API key" },
    onSuccess: (_data, { id }) => invalidateApiKey(queryClient, id),
  })
}

export const updateApiKeyQueryKey = () => [BASE_QUERY_KEY, "update"];
export const useUpdateApiKey = (
  opts?: ServicePutOptions<UpdateApiKey, void>
): UseMutationResult<void, Error, { id: string; data: UpdateApiKey }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: updateApiKeyQueryKey(),
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKey }) =>
      apiKeyService.update(id, data, opts),
    meta: { successMessage: "API Key updated successfully", errorMessage: "Failed to update API Key" },
    onSuccess: (_data, { id }) => invalidateApiKey(queryClient, id),
  })
}

export const deleteApiKeyQueryKey = () => [BASE_QUERY_KEY, "delete"];
export const useDeleteApiKey = (
  opts?: ServiceDeleteOptions<void>
): UseMutationResult<void, Error, { id: string }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: deleteApiKeyQueryKey(),
    mutationFn: ({ id }: { id: string }) =>
      apiKeyService.delete(id, opts),
    meta: { successMessage: "API Key deleted successfully", errorMessage: "Failed to delete API Key" },
    onSuccess: (_data, { id }) => invalidateApiKey(queryClient, id),
  })
}
