import http from "../http";
import {
  authResponseSchema,
  changeOwnPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  userSchema,
} from "@snipet/shared";

import type {
  AuthResponse,
  ChangeOwnPassword,
  Login,
  RefreshToken,
  User,
} from "@snipet/shared";
import type {
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";

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
  body: RefreshToken,
  opts: ServicePostOptions<RefreshToken, AuthResponse> = {},
): Promise<AuthResponse> =>
  http.post({
    url: `${AUTH_URL}/refresh`,
    body,
    schemas: { body: refreshTokenSchema, response: authResponseSchema },
    ...opts,
  });

const logout = async (
  body: RefreshToken,
  opts: ServicePostOptions<RefreshToken, void> = {},
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
  body: ChangeOwnPassword,
  opts: ServicePutOptions<ChangeOwnPassword, void> = {},
): Promise<void> =>
  http.put({
    url: `${AUTH_URL}/me/password`,
    body,
    schemas: { body: changeOwnPasswordSchema },
    ...opts,
  });

export const authService = { login, refresh, logout, me, changePassword };
