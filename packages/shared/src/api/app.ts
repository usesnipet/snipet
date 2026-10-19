import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** Bare origin ("https://app.example.com"): matched exactly against the Origin header. */
const originSchema = z
  .string()
  .refine((s) => URL.canParse(s) && new URL(s).origin === s, "must be an origin like https://app.example.com");

export const appSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  allowedOrigins: z.array(z.string()),
  /** Lets end users start sessions without an app-issued token. */
  allowAnonymous: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type App = z.infer<typeof appSchema>;

export const paginatedAppSchema = paginatedSchema(appSchema);

/** What GET /apps/:id/public shows anyone: only apps with allowAnonymous on. */
export const publicAppSchema = appSchema.pick({ id: true, name: true });
export type PublicApp = z.infer<typeof publicAppSchema>;

/** Create/update fields, without the cross-field rule (zod forbids .partial() and .extend() after .refine()). */
export const appBodySchema = z.object({
  name: z.string().min(1).max(255),
  allowedOrigins: z.array(originSchema).optional(),
  allowAnonymous: z.boolean().optional(),
});

/** Anonymous access is checked by Origin, so an app allowing it must list its origins. */
export const anonymousHasOrigins = (app: { allowAnonymous?: boolean; allowedOrigins?: string[] }) =>
  !app.allowAnonymous || !!app.allowedOrigins?.length;

export const anonymousHasOriginsError = {
  message: "Add at least one origin to allow anonymous users",
  path: ["allowedOrigins"],
};

export const createAppSchema = appBodySchema.refine(anonymousHasOrigins, anonymousHasOriginsError);
export type CreateApp = z.infer<typeof createAppSchema>;

/** Partial, so the rule needs the stored app: the API checks it on update. */
export const updateAppSchema = appBodySchema.partial();
export type UpdateApp = z.infer<typeof updateAppSchema>;

export const findAppsParamsSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
});
export type FindAppsParams = z.infer<typeof findAppsParamsSchema>;

/**
 * Body of POST /apps/issue-token. The caller is an app's backend (it holds the API
 * key), so it's trusted to say who the end user is.
 */
export const issueAppTokenSchema = z.object({
  /** When set, the request fails unless the API key belongs to this app. */
  appId: z.uuid().optional(),
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

/**
 * Body of POST /apps/:id/anonymous-token. Without a refresh token a new anonymous
 * end user is created; with one, the same end user gets fresh tokens.
 */
export const issueAnonymousTokenSchema = z.object({
  refreshToken: z.string().optional(),
});
export type IssueAnonymousToken = z.infer<typeof issueAnonymousTokenSchema>;

export const anonymousTokenResponseSchema = appTokenResponseSchema.extend({
  /** Long-lived; only trades for new tokens at POST /apps/:id/anonymous-token. */
  refreshToken: z.string(),
});
export type AnonymousTokenResponse = z.infer<typeof anonymousTokenResponseSchema>;

/** What the signed token carries. */
export type AppTokenPayload = {
  sub: string;
  user: { name?: string; email?: string; metadata?: Record<string, unknown> };
  app: { id: string; name: string };
};
