import { z } from "zod";

import { userSchema } from "@/models/user";

export { userSchema } from "@/models/user";
export type { User, Role } from "@/models/user";

export const loginSchema = z
  .object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();
export type Login = z.infer<typeof loginSchema>;

// authResponseSchema mirrors auth.AuthResponse (POST /auth/login, /auth/refresh).
export const authResponseSchema = z
  .object({
    access_token: z.string(),
    expires_at: z.coerce.date(),
    refresh_token: z.string(),
    refresh_expires_at: z.coerce.date(),
    user: userSchema,
  })
  .strict();
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "Must be at least 8 characters")
      .max(255),
  })
  .strict();
export type ChangePassword = z.infer<typeof changePasswordSchema>;

// refreshTokenSchema is the body for both /auth/refresh and /auth/logout.
export const refreshTokenSchema = z
  .object({ refresh_token: z.string().min(1) })
  .strict();
export type RefreshTokenPayload = z.infer<typeof refreshTokenSchema>;
