import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** Longest plugin instructions put in a run's context, from the driver or the user. */
export const MAX_PLUGIN_INSTRUCTIONS = 8000;

/**
 * Where a connection stands with its plugin's OAuth: `none` when the plugin
 * has no OAuth, `missing` before the first authorization, `expired` once the
 * token can no longer be refreshed and the user must authorize again.
 */
export const pluginAuthStatusSchema = z.enum(["none", "missing", "connected", "expired"]);
export type PluginAuthStatus = z.infer<typeof pluginAuthStatusSchema>;

/** An authenticated instance of a plugin. */
export const pluginConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  pluginKey: z.string(),
  config: jsonObjectSchema,
  enabled: z.boolean(),
  authStatus: pluginAuthStatusSchema,
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

/**
 * Body of POST /plugin-connections/:id/oauth/authorize. `returnTo` is a path
 * in the web app, never a full URL, so the callback can't be turned into an
 * open redirect.
 */
export const authorizePluginConnectionSchema = z.object({
  returnTo: z
    .string()
    .max(2048)
    .regex(/^\/(?![/\\])/, "must be a path starting with a single /"),
});
export type AuthorizePluginConnection = z.infer<typeof authorizePluginConnectionSchema>;

/** The provider's consent page to send the user to. */
export const pluginConnectionAuthorizationSchema = z.object({ url: z.url() });
export type PluginConnectionAuthorization = z.infer<typeof pluginConnectionAuthorizationSchema>;
