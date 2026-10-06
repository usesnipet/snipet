import { useMutation } from "@tanstack/react-query";

import { appTokenService } from "./service";

import type { AppTokenResponse, CreateAppToken } from "@snipet/shared";
import type { UseMutationResult } from "@tanstack/react-query";

export const useCreateAppToken = (): UseMutationResult<
  AppTokenResponse,
  Error,
  { apiKey: string; data: CreateAppToken }
> =>
  useMutation({
    mutationFn: ({ apiKey, data }) => appTokenService.create(apiKey, data),
    meta: { errorMessage: "Failed to emit token" },
  });
