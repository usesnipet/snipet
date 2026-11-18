import { z } from "zod";

import { jsonObjectSchema } from "./json.js";
import { keySchema } from "./key.js";

/**
 * Which driver runs a capability and the driver's fixed options. String
 * values may hold `{{connection.<field>}}` placeholders.
 */
export const driverSchema = z.object({
  driver: keySchema,
  options: jsonObjectSchema.default({}),
});
export type ManifestDriver = z.infer<typeof driverSchema>;

/**
 * OAuth2 authorization code flow. `clientId` and `clientSecret` may hold
 * `{{connection.<field>}}` or `{{env.OAUTH_<NAME>}}` placeholders; only env
 * vars prefixed `OAUTH_` are visible to them.
 */
export const oauth2ManifestAuthSchema = z.object({
  type: z.literal("oauth2"),
  authorizationUrl: z.url({ protocol: /^https?$/ }),
  tokenUrl: z.url({ protocol: /^https?$/ }),
  revokeUrl: z.url({ protocol: /^https?$/ }).optional(),
  scopes: z.array(z.string()).default([]),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  pkce: z.boolean().default(true),
  /** Added to the authorize URL as is, e.g. Google's `access_type=offline` to get a refresh token. */
  extraParams: z.record(z.string(), z.string()).default({}),
});
export type OAuth2ManifestAuth = z.infer<typeof oauth2ManifestAuthSchema>;

/**
 * OAuth2 found at run time, as MCP servers do: the resource's metadata
 * (RFC 9728) names its authorization server, and each connection registers
 * its own client there (RFC 7591), so nothing is set up beforehand.
 * `resource` may hold `{{connection.<field>}}` placeholders.
 */
export const oauth2DiscoveryManifestAuthSchema = z.object({
  type: z.literal("oauth2_discovery"),
  /** The protected resource's URL, e.g. the MCP server's. */
  resource: z.string().min(1),
  /** Replaces the scopes the resource asks for. */
  scopes: z.array(z.string()).optional(),
});
export type OAuth2DiscoveryManifestAuth = z.infer<typeof oauth2DiscoveryManifestAuthSchema>;

/** How a connection authenticates beyond its `connection` fields. */
export const manifestAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  oauth2ManifestAuthSchema,
  oauth2DiscoveryManifestAuthSchema,
]);
export type ManifestAuth = z.infer<typeof manifestAuthSchema>;

/**
 * Fields every JSON manifest (plugin, llm) shares. `connection` is the JSON
 * Schema of a connection's config; fields marked `secret: true` are secrets.
 */
export const baseManifestSchema = z.object({
  key: keySchema,
  name: z.string().min(1),
  description: z.string().default(""),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  auth: manifestAuthSchema.default({ type: "none" }),
  connection: jsonObjectSchema.default({ type: "object", properties: {} }),
});
export type BaseManifest = z.infer<typeof baseManifestSchema>;
