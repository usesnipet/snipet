import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";

import { mcpServerService } from "./service";

import type {
  CreateMcpServer,
  ListMcpServerRegistry,
  ListMcpServersSearchParams,
  McpServerRegistryItem,
  PaginatedMcpServer,
  UpdateMcpServer,
  McpServer,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "mcp-server";

export const listMcpServersQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListMcpServers = (
  opts?: ServiceGetOptions<PaginatedMcpServer, ListMcpServersSearchParams>,
): UseQueryResult<PaginatedMcpServer, Error> =>
  useQuery({
    queryKey: [...listMcpServersQueryKey(), opts?.searchParams],
    queryFn: () => mcpServerService.list(opts),
  });

export const mcpServerRegistryQueryKey = () =>
  [BASE_QUERY_KEY, "registry"] as const;
export const useMcpServerRegistry = (
  opts?: ServiceGetOptions<ListMcpServerRegistry>,
): UseQueryResult<ListMcpServerRegistry, Error> =>
  useQuery({
    queryKey: mcpServerRegistryQueryKey(),
    queryFn: () => mcpServerService.listRegistry(opts),
    staleTime: Infinity,
  });

export const mcpServerRegistryItemQueryKey = (key: string) =>
  [BASE_QUERY_KEY, "registry", key] as const;
export const useMcpServerRegistryItem = (
  key: string,
  opts?: ServiceGetOptions<McpServerRegistryItem>,
): UseQueryResult<McpServerRegistryItem, Error> =>
  useQuery({
    queryKey: mcpServerRegistryItemQueryKey(key),
    queryFn: () => mcpServerService.findRegistryItem(key, opts),
    enabled: !!key,
    staleTime: Infinity,
  });

export const mcpServerQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useMcpServer = (
  id: string,
  opts?: ServiceGetOptions<McpServer>,
): UseQueryResult<McpServer, Error> =>
  useQuery({
    queryKey: mcpServerQueryKey(id),
    queryFn: () => mcpServerService.findById(id, opts),
    enabled: !!id,
  });

export const useCreateMcpServer = (
  opts?: ServicePostOptions<CreateMcpServer, McpServer>,
): UseMutationResult<McpServer, Error, CreateMcpServer> =>
  useMutation({
    mutationFn: (data: CreateMcpServer) => mcpServerService.create(data, opts),
    onSuccess: () => {
      toast({ title: "MCP server added" });
      queryClient.invalidateQueries({ queryKey: listMcpServersQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to add MCP server", variant: "destructive" });
    },
  });

export const useUpdateMcpServer = (
  id: string,
  opts?: ServicePutOptions<UpdateMcpServer, void>,
): UseMutationResult<void, Error, UpdateMcpServer> =>
  useMutation({
    mutationFn: (data: UpdateMcpServer) => mcpServerService.update(id, data, opts),
    onSuccess: () => {
      toast({ title: "MCP server updated" });
      queryClient.invalidateQueries({ queryKey: listMcpServersQueryKey() });
      queryClient.invalidateQueries({ queryKey: mcpServerQueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update MCP server", variant: "destructive" });
    },
  });

export const useDeleteMcpServer = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => mcpServerService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "MCP server removed" });
      queryClient.invalidateQueries({ queryKey: listMcpServersQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to remove MCP server", variant: "destructive" });
    },
  });
