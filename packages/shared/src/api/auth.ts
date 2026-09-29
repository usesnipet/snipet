import { z } from "zod";

import { userSchema } from "./user.js";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type Login = z.infer<typeof loginSchema>;

// Body of both POST /auth/refresh and POST /auth/logout.
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshToken = z.infer<typeof refreshTokenSchema>;

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(255),
});
export type ChangeOwnPassword = z.infer<typeof changeOwnPasswordSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.coerce.date(),
  refreshToken: z.string(),
  refreshExpiresAt: z.coerce.date(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
