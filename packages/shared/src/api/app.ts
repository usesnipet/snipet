import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// Bare origin ("https://app.example.com"): matched exactly against the Origin header.
const originSchema = z
  .string()
  .refine((s) => URL.canParse(s) && new URL(s).origin === s, "must be an origin like https://app.example.com");

export const appSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  allowedOrigins: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type App = z.infer<typeof appSchema>;

export const paginatedAppSchema = paginatedSchema(appSchema);

export const createAppSchema = z.object({
  name: z.string().min(1).max(255),
  allowedOrigins: z.array(originSchema).optional(),
});
export type CreateApp = z.infer<typeof createAppSchema>;

export const updateAppSchema = createAppSchema.partial();
export type UpdateApp = z.infer<typeof updateAppSchema>;

export const findAppsParamsSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
});
export type FindAppsParams = z.infer<typeof findAppsParamsSchema>;

// Body of POST /apps/issue-token. The caller is an app's backend (it holds the API
// key), so it's trusted to say who the end user is.
export const issueAppTokenSchema = z.object({
  externalUserId: z.string().min(1).max(255),
  name: z.preprocess((val) => (val === "" ? undefined : val), z.string().max(255).optional()),
  email: z.preprocess((val) => (val === "" ? undefined : val), z.email().optional()),
  /** Any extra end-user info the app wants carried in the token. */
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresInSeconds: z
    .number()
    .int()
    .min(60) // 1 minute
    .max(24 * 60 * 60) // 24 hours
    .default(60 * 60), // 1 hour
});
export type IssueAppToken = z.input<typeof issueAppTokenSchema>;

export const appTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.coerce.date(),
});
export type AppTokenResponse = z.infer<typeof appTokenResponseSchema>;

// What the signed token carries.
export type AppTokenPayload = {
  sub: string;
  user: { name?: string; email?: string; metadata?: Record<string, unknown> };
  app: { id: string; name: string };
};
