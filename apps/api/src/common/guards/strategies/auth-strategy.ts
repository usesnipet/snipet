import type { AppTokenPayload, Role } from "@snipet/shared";
import type { Request } from "express";
import type { ApiKey } from "#src/modules/api-key/api-key.entity.js";

/** Metadata key holding a route's strategies, set by @Private/@Public. */
export const AUTH = "auth";

/**
 * One way a route accepts being called. A user must also hold one of `roles`
 * (none = any role).
 */
export type AuthStrategy = { type: "user"; roles: Role[] } | { type: "apiKey" } | { type: "appToken" };

/** Who made the request, set by AuthGuard from the access token. */
export interface AuthUser {
  id: string;
  role: Role;
}

/** How the request authenticated, set by AuthGuard on @Private routes. */
export type RequestAuth =
  { type: "user"; user: AuthUser } | { type: "apiKey"; apiKey: ApiKey } | { type: "appToken"; token: AppTokenPayload };

/** The route's config for one strategy type, e.g. the roles of `UserAuth(...)`. */
export type StrategyOptions<T extends AuthStrategy["type"]> = Extract<AuthStrategy, { type: T }>;

/**
 * Checks one kind of credential. Returns null when the request doesn't carry
 * it (or carries one meant for another strategy), so the guard tries the next;
 * throws when it's this strategy's credential but not acceptable.
 */
export interface AuthStrategyHandler<T extends AuthStrategy["type"]> {
  authenticate(request: Request, options: StrategyOptions<T>): Promise<RequestAuth | null>;
}

/** The token of `Authorization: Bearer <token>`, if any. */
export function bearerToken(request: Request): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" && token ? token : undefined;
}
