import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";

import type { Role } from "@snipet/shared";

// Who made the request, set by AuthGuard from the access token.
export interface AuthUser {
  id: string;
  role: Role;
}

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";
export const ALLOW_API_KEY = "allowApiKey";

// Skips AuthGuard: no token needed.
export const Public = () => SetMetadata(IS_PUBLIC, true);

// Also accepts a valid `X-API-Key` header instead of a bearer token.
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);

// Only these roles may call the route (on top of being authenticated).
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
