import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { hasRole, Role } from "@snipet/shared";

import { AuthUser, IS_PUBLIC, ROLES } from "../decorators/auth.decorators.js";

import type { Request } from "express";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

// Global: every route needs `Authorization: Bearer <access token>` unless
// marked @Public(); @Roles(...) further restricts by role.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      // Public routes still get request.user when a valid token is sent.
      if (isPublic) return true;
      throw new UnauthorizedException("missing bearer token");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException("invalid or expired token");
    }
    request.user = { id: payload.sub, role: payload.role };

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !hasRole(payload.role, roles)) throw new ForbiddenException("insufficient role");
    return true;
  }
}
