import http from "../http";

import {
  createHookConnectionSchema,
  findHookConnectionsParamsSchema,
  hookConnectionSchema,
  hookManifestSchema,
  paginatedHookConnectionSchema,
  updateHookConnectionSchema,
} from "@snipet/shared";
import { z } from "zod";

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

const HOOK_CONNECTION_URL = "/api/hook-connections";

const list = async (
  opts: ServiceGetOptions<Paginated<HookConnection>, Partial<FindHookConnectionsParams>> = {},
): Promise<Paginated<HookConnection>> =>
  http.get({
    url: HOOK_CONNECTION_URL,
    schemas: {
      response: paginatedHookConnectionSchema,
      searchParams: findHookConnectionsParamsSchema,
    },
    ...opts,
  });

const listHooks = async (opts: ServiceGetOptions<HookManifest[]> = {}): Promise<HookManifest[]> =>
  http.get({
    url: `${HOOK_CONNECTION_URL}/hooks`,
    schemas: { response: z.array(hookManifestSchema) },
    ...opts,
  });

const create = async (
  body: CreateHookConnection,
  opts: ServicePostOptions<CreateHookConnection, HookConnection> = {},
): Promise<HookConnection> =>
  http.post({
    url: HOOK_CONNECTION_URL,
    body,
    schemas: { body: createHookConnectionSchema, response: hookConnectionSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdateHookConnection,
  opts: ServicePutOptions<UpdateHookConnection, void> = {},
): Promise<void> =>
  http.put({
    url: `${HOOK_CONNECTION_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateHookConnectionSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${HOOK_CONNECTION_URL}/{id}`,
    params: { id },
    ...opts,
  });

export const hookConnectionService = {
  list,
  listHooks,
  create,
  update,
  delete: remove,
};
