import { z } from "zod";

// Body of POST /app-tokens. The caller is an app's backend (it holds the API
// key), so it's trusted to say who the end user is.
export const createAppTokenSchema = z.object({
  externalUserId: z.string().min(1).max(255),
  name: z.string().max(255).optional(),
  email: z.email().max(255).optional(),
  /** Any extra end-user info the app wants carried in the token. */
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresInSeconds: z
    .number()
    .int()
    .min(60) // 1 minute
    .max(24 * 60 * 60) // 24 hours
    .default(60 * 60), // 1 hour
});
export type CreateAppToken = z.input<typeof createAppTokenSchema>;

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
