import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../schemas/manifest.js";

import { hooksCapabilitySchema } from "./hook.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** Longest plugin instructions put in a run's context, from the driver or the user. */
export const MAX_PLUGIN_INSTRUCTIONS = 8000;

/** The JSON manifest of a plugin. */
export const pluginManifestSchema = baseManifestSchema.extend({
  /** JSON Schema of the per-agent settings; `secret: true` fields are sealed. */
  settings: jsonObjectSchema.optional(),
  capabilities: z
    .object({
      actions: driverSchema.optional(),
      /** How the agent should use the plugin, added to the system prompt of agents granted it. */
      instructions: driverSchema.optional(),
      /** Handlers on the hooks of the agent loop. */
      hooks: hooksCapabilitySchema.optional(),
      healthCheck: driverSchema.optional(),
    })
    .refine((c) => c.actions || c.instructions || c.hooks, "a plugin needs actions, instructions or hooks"),
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
  /** What the instructions driver returned on the last sync. */
  instructions: z.string().nullable(),
  /** Replaces `instructions` when set. */
  customInstructions: z.string().nullable(),
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
  customInstructions: z.string().max(MAX_PLUGIN_INSTRUCTIONS).nullable().optional(),
});
export type CreatePluginConnection = z.infer<typeof createPluginConnectionSchema>;

export const updatePluginConnectionSchema = createPluginConnectionSchema.partial();
export type UpdatePluginConnection = z.infer<typeof updatePluginConnectionSchema>;

export const findPluginConnectionsParamsSchema = paginationParamsSchema.extend({
  pluginKey: z.string().optional(),
});
export type FindPluginConnectionsParams = z.infer<typeof findPluginConnectionsParamsSchema>;
