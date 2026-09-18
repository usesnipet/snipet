import http from "@/lib/http";
import { userSchema } from "@/models/user";

import {
  authResponseSchema,
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
} from "./schemas";

import type {
  AuthResponse,
  ChangePassword,
  Login,
  RefreshTokenPayload,
} from "./schemas";
import type {
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";
import type { User } from "@/models/user";

const AUTH_URL = "/api/auth";

const login = async (
  body: Login,
  opts: ServicePostOptions<Login, AuthResponse> = {},
): Promise<AuthResponse> =>
  http.post({
    url: `${AUTH_URL}/login`,
    body,
    schemas: { body: loginSchema, response: authResponseSchema },
    ...opts,
  });

const refresh = async (
  body: RefreshTokenPayload,
  opts: ServicePostOptions<RefreshTokenPayload, AuthResponse> = {},
): Promise<AuthResponse> =>
  http.post({
    url: `${AUTH_URL}/refresh`,
    body,
    schemas: { body: refreshTokenSchema, response: authResponseSchema },
    ...opts,
  });

const logout = async (
  body: RefreshTokenPayload,
  opts: ServicePostOptions<RefreshTokenPayload, void> = {},
): Promise<void> =>
  http.post({
    url: `${AUTH_URL}/logout`,
    body,
    schemas: { body: refreshTokenSchema },
    ...opts,
  });

const me = async (opts: ServiceGetOptions<User> = {}): Promise<User> =>
  http.get({
    url: `${AUTH_URL}/me`,
    schemas: { response: userSchema },
    ...opts,
  });

const changePassword = async (
  body: ChangePassword,
  opts: ServicePutOptions<ChangePassword, void> = {},
): Promise<void> =>
  http.put({
    url: `${AUTH_URL}/me/password`,
    body,
    schemas: { body: changePasswordSchema },
    ...opts,
  });

export const authService = { login, refresh, logout, me, changePassword };
