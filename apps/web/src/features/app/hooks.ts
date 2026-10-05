import { listApiKeyQueryKey } from "@/features/api-key/hooks";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";

import { appService } from "./service";

import type { App, CreateApp, FindAppsParams, Paginated, UpdateApp } from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";
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
): UseMutationResult<App, Error, CreateApp> =>
  useMutation({
    mutationFn: (data: CreateApp) => appService.create(data, opts),
    onSuccess: () => {
      toast({ title: "App created" });
      queryClient.invalidateQueries({ queryKey: listAppsQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create app", variant: "destructive" });
    },
  });

export const useUpdateApp = (
  id: string,
  opts?: ServicePutOptions<UpdateApp, void>,
): UseMutationResult<void, Error, UpdateApp> =>
  useMutation({
    mutationFn: (data: UpdateApp) => appService.update(id, data, opts),
    onSuccess: () => {
      toast({ title: "App updated" });
      queryClient.invalidateQueries({ queryKey: listAppsQueryKey() });
      queryClient.invalidateQueries({ queryKey: appQueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update app", variant: "destructive" });
    },
  });

// Deleting an app also deletes its API keys (and sessions) on the server.
export const useDeleteApp = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => appService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "App deleted" });
      queryClient.invalidateQueries({ queryKey: listAppsQueryKey() });
      queryClient.invalidateQueries({ queryKey: listApiKeyQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete app", variant: "destructive" });
    },
  });
