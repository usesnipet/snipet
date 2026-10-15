import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsService } from "./service";

import type { Settings, UpdateSettings } from "@snipet/shared";
import type { ServiceGetOptions } from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

export const settingsQueryKey = () => ["settings"] as const;

export const useSettings = (opts?: ServiceGetOptions<Settings>): UseQueryResult<Settings, Error> =>
  useQuery({
    queryKey: settingsQueryKey(),
    queryFn: () => settingsService.get(opts),
  });

export const useUpdateSettings = (): UseMutationResult<void, Error, UpdateSettings> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettings) => settingsService.update(data),
    meta: { successMessage: "Settings updated", errorMessage: "Failed to update settings" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsQueryKey() }),
  });
};
