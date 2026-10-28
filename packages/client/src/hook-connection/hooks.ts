import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { hookConnectionService } from "./service";

import type {
  CreateHookConnection,
  FindHookConnectionsParams,
  HookConnection,
  HookManifest,
  Paginated,
  UpdateHookConnection,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "hook-connection";

export const listHookConnectionsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListHookConnections = (
  opts?: ServiceGetOptions<Paginated<HookConnection>, Partial<FindHookConnectionsParams>>,
): UseQueryResult<Paginated<HookConnection>, Error> =>
  useQuery({
    queryKey: [...listHookConnectionsQueryKey(), opts?.searchParams],
    queryFn: () => hookConnectionService.list(opts),
  });

export const hookManifestsQueryKey = () => [BASE_QUERY_KEY, "hooks"] as const;
export const useHookManifests = (opts?: ServiceGetOptions<HookManifest[]>): UseQueryResult<HookManifest[], Error> =>
  useQuery({
    queryKey: hookManifestsQueryKey(),
    queryFn: () => hookConnectionService.listHooks(opts),
  });

export const useCreateHookConnection = (
  opts?: ServicePostOptions<CreateHookConnection, HookConnection>,
): UseMutationResult<HookConnection, Error, { data: CreateHookConnection }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }) => hookConnectionService.create(data, opts),
    meta: { successMessage: "Hook connection created", errorMessage: "Failed to create hook connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listHookConnectionsQueryKey() }),
  });
};

export const useUpdateHookConnection = (
  opts?: ServicePutOptions<UpdateHookConnection, void>,
): UseMutationResult<void, Error, { id: string; data: UpdateHookConnection }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => hookConnectionService.update(id, data, opts),
    meta: { successMessage: "Hook connection updated", errorMessage: "Failed to update hook connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listHookConnectionsQueryKey() }),
  });
};

export const useDeleteHookConnection = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hookConnectionService.delete(id, opts),
    meta: { successMessage: "Hook connection deleted", errorMessage: "Failed to delete hook connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listHookConnectionsQueryKey() }),
  });
};
