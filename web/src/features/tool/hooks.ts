import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { toolService } from "./service";

import type {
  ListToolsSearchParams,
  PaginatedTool,
  Tool,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
} from "@/lib/services";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "tool";

export const listToolsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListTools = (
  opts?: ServiceGetOptions<PaginatedTool, ListToolsSearchParams>,
): UseQueryResult<PaginatedTool, Error> =>
  useQuery({
    queryKey: [...listToolsQueryKey(), opts?.searchParams],
    queryFn: () => toolService.list(opts),
    placeholderData: keepPreviousData,
  });

export const toolQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useTool = (
  id: string,
  opts?: ServiceGetOptions<Tool>,
): UseQueryResult<Tool, Error> =>
  useQuery({
    queryKey: toolQueryKey(id),
    queryFn: () => toolService.findById(id, opts),
    enabled: !!id,
  });

export const useDeleteTool = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => toolService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "Tool deleted" });
      queryClient.invalidateQueries({ queryKey: listToolsQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete Tool", variant: "destructive" });
    },
  });
