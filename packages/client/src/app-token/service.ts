import http from "../http";

import { appTokenResponseSchema, createAppTokenSchema } from "@snipet/shared";

import type { AppTokenResponse, CreateAppToken } from "@snipet/shared";
import type { ServicePostOptions } from "../http";

const APP_TOKEN_URL = "/api/app-tokens";

// create emits an end-user token for the API key's app. API key only: no
// bearer token, and a 401 (bad key) mustn't log the dashboard user out.
const create = async (
  apiKey: string,
  body: CreateAppToken,
  opts: ServicePostOptions<CreateAppToken, AppTokenResponse> = {},
): Promise<AppTokenResponse> =>
  http.post({
    url: APP_TOKEN_URL,
    body,
    headers: { "X-API-Key": apiKey },
    skipAuth: true,
    schemas: { body: createAppTokenSchema, response: appTokenResponseSchema },
    ...opts,
  });

export const appTokenService = { create };
