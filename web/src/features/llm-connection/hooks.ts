import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";

import { llmConnectionService } from "./service";

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
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "llm-connection";

export const listLlmConnectionsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListLlmConnections = (
  opts?: ServiceGetOptions<PaginatedLlmConnection, ListLlmConnectionsSearchParams>,
): UseQueryResult<PaginatedLlmConnection, Error> =>
  useQuery({
    queryKey: [...listLlmConnectionsQueryKey(), opts?.searchParams],
    queryFn: () => llmConnectionService.list(opts),
  });

export const llmProvidersQueryKey = () =>
  [BASE_QUERY_KEY, "providers"] as const;
export const useLlmProviders = (
  opts?: ServiceGetOptions<ListLlmProvider>,
): UseQueryResult<ListLlmProvider, Error> =>
  useQuery({
    queryKey: llmProvidersQueryKey(),
    queryFn: () => llmConnectionService.listProviders(opts),
  });

export const llmConnectionQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useLlmConnection = (
  id: string,
  opts?: ServiceGetOptions<LlmConnection>,
): UseQueryResult<LlmConnection, Error> =>
  useQuery({
    queryKey: llmConnectionQueryKey(id),
    queryFn: () => llmConnectionService.findById(id, opts),
    enabled: !!id,
  });

export const useCreateLlmConnection = (
  opts?: ServicePostOptions<CreateLlmConnection, LlmConnection>,
): UseMutationResult<LlmConnection, Error, { data: CreateLlmConnection }> =>
  useMutation({
    mutationFn: ({ data }) => llmConnectionService.create(data, opts),
    onSuccess: () => {
      toast({ title: "LLM connection created" });
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create LLM connection", variant: "destructive" });
    },
  });

export const useUpdateLlmConnection = (
  opts?: ServicePutOptions<UpdateLlmConnection, void>,
): UseMutationResult<void, Error, { id: string, data: UpdateLlmConnection }> =>
  useMutation({
    mutationFn: ({ data, id }) => llmConnectionService.update(id, data, opts),
    onSuccess: (_, { id }) => {
      toast({ title: "LLM connection updated" });
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: llmConnectionQueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update LLM connection", variant: "destructive" });
    },
  });

export const useDeleteLlmConnection = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => llmConnectionService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "LLM connection deleted" });
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete LLM connection", variant: "destructive" });
    },
  });
