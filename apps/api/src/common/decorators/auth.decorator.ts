import { createParamDecorator, ExecutionContext, InternalServerErrorException, SetMetadata } from "@nestjs/common";

import type { Role } from "@snipet/shared";
import type { ApiKey } from "../../modules/api-key/api-key.entity.js";

// Who made the request, set by AuthGuard from the access token.
export interface AuthUser {
  id: string;
  role: Role;
}

// One way a route accepts being called. A user must also hold one of `roles`
// (none = any role).
export type AuthStrategy = { type: "user"; roles: Role[] } | { type: "apiKey" };

export const AUTH = "auth";

// `Authorization: Bearer <access token>`, optionally limited to these roles.
export const UserAuth = (...roles: Role[]): AuthStrategy => ({ type: "user", roles });

// `X-API-Key: <key>`.
export const ApiKeyAuth = (): AuthStrategy => ({ type: "apiKey" });

// On a class or method; the method's wins. Routes with neither are denied.
export const Private = (...strategies: AuthStrategy[]) => SetMetadata(AUTH, strategies);
export const Public = () => SetMetadata(AUTH, []);

// How the request authenticated, set by AuthGuard on @Private routes.
export type RequestAuth = { type: "user"; user: AuthUser } | { type: "apiKey"; apiKey: ApiKey };

// Throws when the route isn't @Private: reading the caller there is a bug.
export function requestAuth(ctx: ExecutionContext): RequestAuth {
  const auth = ctx.switchToHttp().getRequest<{ auth?: RequestAuth }>().auth;
  if (!auth) throw new InternalServerErrorException("route reads the caller but isn't @Private");
  return auth;
}

// The logged-in user; undefined when the request used an API key.
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const auth = requestAuth(ctx);
  return auth.type === "user" ? auth.user : undefined;
});

// The key that authenticated the request; undefined when a user did.
export const CurrentApiKey = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const auth = requestAuth(ctx);
  return auth.type === "apiKey" ? auth.apiKey : undefined;
});
