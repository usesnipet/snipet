import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";

import { llmProviderService } from "./service";

import type {
  CreateLlmProvider,
  ListLlmProvidersSearchParams,
  LlmProviderRegistry,
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
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "llm-provider";

export const listLlmProvidersQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListLlmProviders = (
  opts?: ServiceGetOptions<PaginatedLlmProvider, ListLlmProvidersSearchParams>,
): UseQueryResult<PaginatedLlmProvider, Error> =>
  useQuery({
    queryKey: [...listLlmProvidersQueryKey(), opts?.searchParams],
    queryFn: () => llmProviderService.list(opts),
  });

export const llmProviderRegistryQueryKey = () =>
  [BASE_QUERY_KEY, "registry"] as const;
export const useLlmProviderRegistry = (
  opts?: ServiceGetOptions<LlmProviderRegistry>,
): UseQueryResult<LlmProviderRegistry, Error> =>
  useQuery({
    queryKey: llmProviderRegistryQueryKey(),
    queryFn: () => llmProviderService.listRegistry(opts),
  });

export const llmProviderQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useLlmProvider = (
  id: string,
  opts?: ServiceGetOptions<LlmProvider>,
): UseQueryResult<LlmProvider, Error> =>
  useQuery({
    queryKey: llmProviderQueryKey(id),
    queryFn: () => llmProviderService.findById(id, opts),
    enabled: !!id,
  });

export const useCreateLlmProvider = (
  opts?: ServicePostOptions<CreateLlmProvider, LlmProvider>,
): UseMutationResult<LlmProvider, Error, { data: CreateLlmProvider }> =>
  useMutation({
    mutationFn: ({ data }) => llmProviderService.create(data, opts),
    onSuccess: () => {
      toast({ title: "LlmProvider created" });
      queryClient.invalidateQueries({ queryKey: listLlmProvidersQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create LlmProvider", variant: "destructive" });
    },
  });

export const useUpdateLlmProvider = (
  opts?: ServicePutOptions<UpdateLlmProvider, void>,
): UseMutationResult<void, Error, { id: string, data: UpdateLlmProvider }> =>
  useMutation({
    mutationFn: ({ data, id }) => llmProviderService.update(id, data, opts),
    onSuccess: (_, { id }) => {
      toast({ title: "LlmProvider updated" });
      queryClient.invalidateQueries({ queryKey: listLlmProvidersQueryKey() });
      queryClient.invalidateQueries({ queryKey: llmProviderQueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update LlmProvider", variant: "destructive" });
    },
  });

export const useDeleteLlmProvider = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => llmProviderService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "LlmProvider deleted" });
      queryClient.invalidateQueries({ queryKey: listLlmProvidersQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete LlmProvider", variant: "destructive" });
    },
  });
