import {
  appSchema,
  appTokenResponseSchema,
  createAppSchema,
  findAppsParamsSchema,
  issueAppTokenSchema,
  paginatedAppSchema,
  updateAppSchema,
} from "@snipet/shared";

import http from "../http";

import type { App, AppTokenResponse, CreateApp, FindAppsParams, IssueAppToken, Paginated, UpdateApp } from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";

const APP_URL = "/api/apps";

const list = async (
  opts: ServiceGetOptions<Paginated<App>, Partial<FindAppsParams>> = {},
): Promise<Paginated<App>> =>
  http.get({
    url: APP_URL,
    schemas: {
      response: paginatedAppSchema,
      searchParams: findAppsParamsSchema,
    },
    ...opts,
  });

const findById = async (id: string, opts: ServiceGetOptions<App> = {}): Promise<App> =>
  http.get({
    url: `${APP_URL}/{id}`,
    params: { id },
    schemas: { response: appSchema },
    ...opts,
  });

const create = async (
  body: CreateApp,
  opts: ServicePostOptions<CreateApp, App> = {},
): Promise<App> =>
  http.post({
    url: APP_URL,
    body,
    schemas: { body: createAppSchema, response: appSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdateApp,
  opts: ServicePutOptions<UpdateApp, void> = {},
): Promise<void> =>
  http.put({
    url: `${APP_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateAppSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${APP_URL}/{id}`,
    params: { id },
    ...opts,
  });

// issueToken emits an end-user token for the API key's app. API key only: no
// bearer token, and a 401 (bad key) mustn't log the dashboard user out.
const issueToken = async (
  apiKey: string,
  body: IssueAppToken,
  opts: ServicePostOptions<IssueAppToken, AppTokenResponse> = {},
): Promise<AppTokenResponse> =>
  http.post({
    url: `${APP_URL}/issue-token`,
    body,
    headers: { "X-API-Key": apiKey },
    skipAuth: true,
    schemas: { body: issueAppTokenSchema, response: appTokenResponseSchema },
    ...opts,
  });

export const appService = {
  list,
  findById,
  create,
  update,
  delete: remove,
  issueToken,
};
