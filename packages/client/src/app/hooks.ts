import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listApiKeyQueryKey } from "../api-key/hooks";

import { appService } from "./service";

import type { App, CreateApp, FindAppsParams, Paginated, UpdateApp } from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "app";

export const listAppsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListApps = (
  opts?: ServiceGetOptions<Paginated<App>, Partial<FindAppsParams>>,
): UseQueryResult<Paginated<App>, Error> =>
  useQuery({
    queryKey: [...listAppsQueryKey(), opts?.searchParams],
    queryFn: () => appService.list(opts),
  });

export const appQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useApp = (id: string, opts?: ServiceGetOptions<App>): UseQueryResult<App, Error> =>
  useQuery({
    queryKey: appQueryKey(id),
    queryFn: () => appService.findById(id, opts),
    enabled: !!id,
  });

export const useCreateApp = (
  opts?: ServicePostOptions<CreateApp, App>,
): UseMutationResult<App, Error, CreateApp> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApp) => appService.create(data, opts),
    meta: { successMessage: "App created", errorMessage: "Failed to create app" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listAppsQueryKey() }),
  });
};

export const useUpdateApp = (
  id: string,
  opts?: ServicePutOptions<UpdateApp, void>,
): UseMutationResult<void, Error, UpdateApp> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateApp) => appService.update(id, data, opts),
    meta: { successMessage: "App updated", errorMessage: "Failed to update app" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listAppsQueryKey() });
      queryClient.invalidateQueries({ queryKey: appQueryKey(id) });
    },
  });
};

// Deleting an app also deletes its API keys (and sessions) on the server.
export const useDeleteApp = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appService.delete(id, opts),
    meta: { successMessage: "App deleted", errorMessage: "Failed to delete app" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listAppsQueryKey() });
      queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
    },
  });
};
