import { createParamDecorator, ExecutionContext, InternalServerErrorException, SetMetadata } from "@nestjs/common";

import { AUTH } from "../guards/strategies/auth-strategy.js";

import type { Role } from "@snipet/shared";
import type { AuthStrategy, RequestAuth } from "../guards/strategies/auth-strategy.js";

/** `Authorization: Bearer <access token>`, optionally limited to these roles. */
export const UserAuth = (...roles: Role[]): AuthStrategy => ({ type: "user", roles });

/** `X-API-Key: <key>`. */
export const ApiKeyAuth = (): AuthStrategy => ({ type: "apiKey" });

/** `Authorization: Bearer <app token>`: an app's end user, e.g. from the widget. */
export const AppTokenAuth = (): AuthStrategy => ({ type: "appToken" });

/** On a class or method; the method's wins. Routes with neither are denied. */
export const Private = (...strategies: AuthStrategy[]) => SetMetadata(AUTH, strategies);
export const Public = () => SetMetadata(AUTH, []);

/** Throws when the route isn't @Private: reading the caller there is a bug. */
export function requestAuth(ctx: ExecutionContext): RequestAuth {
  const auth = ctx.switchToHttp().getRequest<{ auth?: RequestAuth }>().auth;
  if (!auth) throw new InternalServerErrorException("route reads the caller but isn't @Private");
  return auth;
}

/** The logged-in user; undefined when the request used another credential. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const auth = requestAuth(ctx);
  return auth.type === "user" ? auth.user : undefined;
});

/** The key that authenticated the request; undefined when something else did. */
export const CurrentApiKey = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const auth = requestAuth(ctx);
  return auth.type === "apiKey" ? auth.apiKey : undefined;
});
