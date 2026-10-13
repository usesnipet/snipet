import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// One capability of a plugin: which driver runs it and the driver's fixed
// options. String values may hold `{{connection.<field>}}` placeholders.
export const pluginCapabilitySchema = z.object({
  driver: z.string().min(1),
  options: z.record(z.string(), z.unknown()).default({}),
});
export type PluginCapability = z.infer<typeof pluginCapabilitySchema>;

// The JSON manifest of a plugin (see plan/plugin.md).
export const pluginManifestSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().default(""),
  icon: z.string().optional(),
  auth: z.object({ type: z.literal("none") }).default({ type: "none" }),
  connection: z.record(z.string(), z.unknown()).default({ type: "object", properties: {} }),
  actions: pluginCapabilitySchema.optional(),
  healthCheck: pluginCapabilitySchema.optional(),
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

// An authenticated instance of a plugin.
export const pluginConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  pluginKey: z.string(),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  lastSyncedAt: z.coerce.date().nullable(),
  lastSyncedError: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type PluginConnection = z.infer<typeof pluginConnectionSchema>;

export const paginatedPluginConnectionSchema = paginatedSchema(pluginConnectionSchema);

// config is checked against the manifest's `connection` schema by the API.
export const createPluginConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  pluginKey: z.string().min(1).max(255),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional(),
});
export type CreatePluginConnection = z.infer<typeof createPluginConnectionSchema>;

export const updatePluginConnectionSchema = createPluginConnectionSchema.partial();
export type UpdatePluginConnection = z.infer<typeof updatePluginConnectionSchema>;

export const findPluginConnectionsParamsSchema = paginationParamsSchema.extend({
  pluginKey: z.string().optional(),
});
export type FindPluginConnectionsParams = z.infer<typeof findPluginConnectionsParamsSchema>;
