import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { syncState } from "./sync-state";
import { mcpServerService } from "./service";

import type {
  CreateMcpServer,
  FindMcpServersParams,
  McpServer,
  McpServerRegistryItem,
  Paginated,
  UpdateMcpServer,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "mcp-server";

export const listMcpServersQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListMcpServers = (
  opts?: ServiceGetOptions<Paginated<McpServer>, Partial<FindMcpServersParams>>,
): UseQueryResult<Paginated<McpServer>, Error> =>
  useQuery({
    queryKey: [...listMcpServersQueryKey(), opts?.searchParams],
    queryFn: () => mcpServerService.list(opts),
    // Tool sync runs in the background after create/update; poll until it settles.
    refetchInterval: (query) =>
      query.state.data?.data.some((server) => syncState(server).kind === "pending")
        ? 5000
        : false,
  });

export const mcpServerRegistryQueryKey = () =>
  [BASE_QUERY_KEY, "registry"] as const;
export const useMcpServerRegistry = (
  opts?: ServiceGetOptions<McpServerRegistryItem[]>,
): UseQueryResult<McpServerRegistryItem[], Error> =>
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
): UseMutationResult<McpServer, Error, CreateMcpServer> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMcpServer) => mcpServerService.create(data, opts),
    meta: { successMessage: "MCP server added", errorMessage: "Failed to add MCP server" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listMcpServersQueryKey() }),
  });
};

export const useUpdateMcpServer = (
  id: string,
  opts?: ServicePutOptions<UpdateMcpServer, void>,
): UseMutationResult<void, Error, UpdateMcpServer> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMcpServer) => mcpServerService.update(id, data, opts),
    meta: { successMessage: "MCP server updated", errorMessage: "Failed to update MCP server" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listMcpServersQueryKey() });
      queryClient.invalidateQueries({ queryKey: mcpServerQueryKey(id) });
    },
  });
};

export const useDeleteMcpServer = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mcpServerService.delete(id, opts),
    meta: { successMessage: "MCP server removed", errorMessage: "Failed to remove MCP server" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listMcpServersQueryKey() }),
  });
};
