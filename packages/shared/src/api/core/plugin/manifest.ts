import z from "zod";

import { jsonObjectSchema } from "../../../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../../../schemas/manifest.js";

import { hooksCapabilitySchema } from "./hook/capability.js";

/** The JSON manifest of a plugin. */
export const pluginManifestSchema = baseManifestSchema.extend({
  /** JSON Schema of the per-agent settings; `secret: true` fields are sealed. */
  settings: jsonObjectSchema.optional(),
  capabilities: z
    .object({
      tools: driverSchema.optional(),
      /** How the agent should use the plugin, added to the system prompt of agents granted it. */
      instructions: driverSchema.optional(),
      /** Handlers on the hooks of the agent loop. */
      hooks: hooksCapabilitySchema.optional(),
      healthCheck: driverSchema.optional(),
    })
    .refine((c) => c.tools || c.instructions || c.hooks, "a plugin needs tools, instructions or hooks"),
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
