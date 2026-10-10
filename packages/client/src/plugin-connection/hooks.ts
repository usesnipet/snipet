import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { syncState } from "../mcp-server/sync-state";

import { pluginConnectionService } from "./service";

import type {
  CreatePluginConnection,
  FindPluginConnectionsParams,
  Paginated,
  PluginConnection,
  PluginManifest,
  UpdatePluginConnection,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "plugin-connection";

export const listPluginConnectionsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListPluginConnections = (
  opts?: ServiceGetOptions<Paginated<PluginConnection>, FindPluginConnectionsParams>,
): UseQueryResult<Paginated<PluginConnection>, Error> =>
  useQuery({
    queryKey: [...listPluginConnectionsQueryKey(), opts?.searchParams],
    queryFn: () => pluginConnectionService.list(opts),
    // Action sync runs in the background after create; poll until it settles.
    refetchInterval: (query) =>
      query.state.data?.data.some((conn) => syncState(conn).kind === "pending") ? 5000 : false,
  });

export const pluginsQueryKey = () => [BASE_QUERY_KEY, "plugins"] as const;
export const usePlugins = (
  opts?: ServiceGetOptions<PluginManifest[]>,
): UseQueryResult<PluginManifest[], Error> =>
  useQuery({
    queryKey: pluginsQueryKey(),
    queryFn: () => pluginConnectionService.listPlugins(opts),
  });

export const useCreatePluginConnection = (
  opts?: ServicePostOptions<CreatePluginConnection, PluginConnection>,
): UseMutationResult<PluginConnection, Error, { data: CreatePluginConnection }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }) => pluginConnectionService.create(data, opts),
    meta: { successMessage: "Plugin connection created", errorMessage: "Failed to create plugin connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listPluginConnectionsQueryKey() }),
  });
};

export const useUpdatePluginConnection = (
  opts?: ServicePutOptions<UpdatePluginConnection, void>,
): UseMutationResult<void, Error, { id: string; data: UpdatePluginConnection }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => pluginConnectionService.update(id, data, opts),
    meta: { successMessage: "Plugin connection updated", errorMessage: "Failed to update plugin connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listPluginConnectionsQueryKey() }),
  });
};

export const useDeletePluginConnection = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pluginConnectionService.delete(id, opts),
    meta: { successMessage: "Plugin connection deleted", errorMessage: "Failed to delete plugin connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listPluginConnectionsQueryKey() }),
  });
};

export const useSyncPluginConnection = (
  opts?: ServicePostOptions<void, void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pluginConnectionService.sync(id, opts),
    meta: { successMessage: "Plugin connection synced", errorMessage: "Failed to sync plugin connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listPluginConnectionsQueryKey() }),
  });
};
