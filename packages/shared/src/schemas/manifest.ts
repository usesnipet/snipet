import { z } from "zod";

import { jsonObjectSchema } from "./json.js";
import { keySchema } from "./key.js";

// Which driver runs a capability and the driver's fixed options. String
// values may hold `{{connection.<field>}}` placeholders.
export const driverSchema = z.object({
  driver: keySchema,
  options: jsonObjectSchema.default({}),
});
export type ManifestDriver = z.infer<typeof driverSchema>;

// Fields every JSON manifest (plugin, llm) shares. `connection` is the JSON
// Schema of a connection's config; fields marked `secret: true` are secrets.
export const baseManifestSchema = z.object({
  key: keySchema,
  name: z.string().min(1),
  description: z.string().default(""),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  auth: z.object({ type: z.literal("none") }).default({ type: "none" }),
  connection: jsonObjectSchema.default({ type: "object", properties: {} }),
});
export type BaseManifest = z.infer<typeof baseManifestSchema>;
