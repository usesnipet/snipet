import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";

import type { Role } from "@snipet/shared";

// Who made the request, set by AuthGuard from the access token.
export interface AuthUser {
  id: string;
  role: Role;
}

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";

// Skips AuthGuard: no token needed.
export const Public = () => SetMetadata(IS_PUBLIC, true);

// Only these roles may call the route (on top of being authenticated).
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
