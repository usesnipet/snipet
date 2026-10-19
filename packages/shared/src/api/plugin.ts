import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../schemas/manifest.js";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** The JSON manifest of a plugin. */
export const pluginManifestSchema = baseManifestSchema.extend({
  actions: driverSchema.optional(),
  healthCheck: driverSchema.optional(),
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

/** An authenticated instance of a plugin. */
export const pluginConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  pluginKey: z.string(),
  config: jsonObjectSchema,
  enabled: z.boolean(),
  lastSyncedAt: z.coerce.date().nullable(),
  lastSyncedError: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type PluginConnection = z.infer<typeof pluginConnectionSchema>;

export const paginatedPluginConnectionSchema = paginatedSchema(pluginConnectionSchema);

/** config is checked against the manifest's `connection` schema by the API. */
export const createPluginConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  pluginKey: z.string().min(1).max(255),
  config: jsonObjectSchema,
  enabled: z.boolean().optional(),
});
export type CreatePluginConnection = z.infer<typeof createPluginConnectionSchema>;

export const updatePluginConnectionSchema = createPluginConnectionSchema.partial();
export type UpdatePluginConnection = z.infer<typeof updatePluginConnectionSchema>;

export const findPluginConnectionsParamsSchema = paginationParamsSchema.extend({
  pluginKey: z.string().optional(),
});
export type FindPluginConnectionsParams = z.infer<typeof findPluginConnectionsParamsSchema>;
