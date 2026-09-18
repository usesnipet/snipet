import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiKeyService } from "./service";

import type {
  ApiKey, ApiKeyWithSecret, CreateApiKey, ListApiKeySearchParams, PaginatedApiKey,
  UpdateApiKeyExpiration
} from "./schemas";
import type {
  ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions
} from "@/lib/services";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "api-key";

export const listApiKeyQueryKey = () => [BASE_QUERY_KEY, "list"] as const;
export const useListApiKey = (
  opts?: ServiceGetOptions<PaginatedApiKey, ListApiKeySearchParams>
): UseQueryResult<PaginatedApiKey, Error> => {
  return useQuery({
    queryKey: [...listApiKeyQueryKey(), opts?.searchParams],
    queryFn: () => apiKeyService.list(opts),
  })
}

export const createApiKeyQueryKey = () => [BASE_QUERY_KEY, "create"];
export const useCreateApiKey = (
  opts?: ServicePostOptions<CreateApiKey, ApiKeyWithSecret>
): UseMutationResult<ApiKeyWithSecret, Error, { data: CreateApiKey }> => {
  return useMutation({
    mutationKey: createApiKeyQueryKey(),
    mutationFn: ({ data }: { data: CreateApiKey }) =>
      apiKeyService.create(data, opts),
    onSuccess: () => {
      toast({
        title: "API Key created successfully",
        description: "The API key has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
    },
    onError: () => {
      toast({
        title: "Failed to create API Key",
        description: "The API Key has not been created successfully",
        variant: "destructive",
      });
    }
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

export const rollApiKeyQueryKey = () => [BASE_QUERY_KEY, "roll"];
export const useRollApiKey = (
  opts?: ServicePostOptions<undefined, ApiKeyWithSecret>
): UseMutationResult<ApiKeyWithSecret, Error, { id: string }> => {
  return useMutation({
    mutationKey: rollApiKeyQueryKey(),
    mutationFn: ({ id }: { id: string }) =>
      apiKeyService.roll(id, opts),
    onSuccess: (_data, { id }) => {
      toast({
        title: "API Key rolled successfully",
        description: "The API key has been rolled successfully",
      });
      queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
      queryClient.invalidateQueries({ queryKey: meApiKeyQueryKey() });
      queryClient.invalidateQueries({ queryKey: findByIdApiKeyQueryKey(id) });
    },
    onError: () => {
      toast({
        title: "Failed to roll API key",
        description: "The API key has not been rolled successfully",
        variant: "destructive",
      });
    }
  })
}

export const updateExpirationApiKeyQueryKey = () => [BASE_QUERY_KEY, "updateExpiration"];
export const useUpdateExpirationApiKey = (
  opts?: ServicePutOptions<UpdateApiKeyExpiration, void>
): UseMutationResult<void, Error, { id: string; data: UpdateApiKeyExpiration }> => {
  return useMutation({
    mutationKey: updateExpirationApiKeyQueryKey(),
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyExpiration }) =>
      apiKeyService.updateExpiration(id, data, opts),
    onSuccess: (_data, { id }) => {
      toast({
        title: "API Key expiration updated successfully",
        description: "The API key expiration has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
      queryClient.invalidateQueries({ queryKey: meApiKeyQueryKey() });
      queryClient.invalidateQueries({ queryKey: findByIdApiKeyQueryKey(id) });
    },
    onError: () => {
      toast({
        title: "Failed to update API Key expiration",
        description: "The API Key expiration has not been updated successfully",
        variant: "destructive",
      });
    }
  })
}

export const deleteApiKeyQueryKey = () => [BASE_QUERY_KEY, "delete"];
export const useDeleteApiKey = (
  opts?: ServiceDeleteOptions<void>
): UseMutationResult<void, Error, { id: string }> => {
  return useMutation({
    mutationKey: deleteApiKeyQueryKey(),
    mutationFn: ({ id }: { id: string }) =>
      apiKeyService.delete(id, opts),
    onSuccess: (_data, { id }) => {
      toast({
        title: "API Key deleted successfully",
        description: "The API key has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
      queryClient.invalidateQueries({ queryKey: meApiKeyQueryKey() });
      queryClient.invalidateQueries({ queryKey: findByIdApiKeyQueryKey(id) });
    },
    onError: () => {
      toast({
        title: "Failed to delete API Key",
        description: "The API key has not been deleted successfully",
        variant: "destructive",
      });
    }
  })
}
