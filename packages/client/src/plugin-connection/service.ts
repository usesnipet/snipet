import http from "../http";

import {
  createPluginConnectionSchema,
  findPluginConnectionsParamsSchema,
  paginatedPluginConnectionSchema,
  pluginConnectionSchema,
  updatePluginConnectionSchema,
} from "@snipet/shared";
import { llmToolSchema, pluginManifestSchema } from "@snipet/shared/core";
import { z } from "zod";

import type {
  CreatePluginConnection,
  FindPluginConnectionsParams,
  Paginated,
  PluginConnection,
  UpdatePluginConnection,
} from "@snipet/shared";
import type { LLMTool, PluginManifest } from "@snipet/shared/core";
import type { ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions } from "../http";

const PLUGIN_CONNECTION_URL = "/api/plugin-connections";

const list = async (
  opts: ServiceGetOptions<Paginated<PluginConnection>, Partial<FindPluginConnectionsParams>> = {},
): Promise<Paginated<PluginConnection>> =>
  http.get({
    url: PLUGIN_CONNECTION_URL,
    schemas: {
      response: paginatedPluginConnectionSchema,
      searchParams: findPluginConnectionsParamsSchema,
    },
    ...opts,
  });

const listPlugins = async (opts: ServiceGetOptions<PluginManifest[]> = {}): Promise<PluginManifest[]> =>
  http.get({
    url: `${PLUGIN_CONNECTION_URL}/plugins`,
    schemas: { response: z.array(pluginManifestSchema) },
    ...opts,
  });

const listTools = async (id: string, opts: ServiceGetOptions<LLMTool[]> = {}): Promise<LLMTool[]> =>
  http.get({
    url: `${PLUGIN_CONNECTION_URL}/{id}/tools`,
    params: { id },
    schemas: { response: z.array(llmToolSchema) },
    ...opts,
  });

const create = async (
  body: CreatePluginConnection,
  opts: ServicePostOptions<CreatePluginConnection, PluginConnection> = {},
): Promise<PluginConnection> =>
  http.post({
    url: PLUGIN_CONNECTION_URL,
    body,
    schemas: { body: createPluginConnectionSchema, response: pluginConnectionSchema },
    ...opts,
  });

const update = async (
  id: string,
  body: UpdatePluginConnection,
  opts: ServicePutOptions<UpdatePluginConnection, void> = {},
): Promise<void> =>
  http.put({
    url: `${PLUGIN_CONNECTION_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updatePluginConnectionSchema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${PLUGIN_CONNECTION_URL}/{id}`,
    params: { id },
    ...opts,
  });

const sync = async (id: string, opts: ServicePostOptions<void, void> = {}): Promise<void> =>
  http.post({
    url: `${PLUGIN_CONNECTION_URL}/{id}/sync`,
    params: { id },
    ...opts,
  });

export const pluginConnectionService = {
  list,
  listPlugins,
  listTools,
  create,
  update,
  delete: remove,
  sync,
};
