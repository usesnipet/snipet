import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { hasRole, Role } from "@snipet/shared";

import { ApiKeyService } from "../../modules/api-key/api-key.service.js";
import { AUTH, AuthStrategy } from "../decorators/auth.decorator.js";

import type { Request } from "express";
import type { RequestAuth } from "../decorators/auth.decorator.js";
export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

// Global: @Public() routes pass; @Private(...) routes need a credential for one
// of their strategies, tried in order (sets request.auth); anything else is
// denied, so a forgotten decorator fails closed.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const strategies = this.reflector.getAllAndOverride<AuthStrategy[] | undefined>(AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!strategies) throw new ForbiddenException("route is neither @Public nor @Private");

    const request = context.switchToHttp().getRequest<Request & { auth?: RequestAuth }>();
    const apiKey = request.headers["x-api-key"];
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];

    for (const strategy of strategies) {
      if (strategy.type === "apiKey" && typeof apiKey === "string" && apiKey) {
        request.auth = { type: "apiKey", apiKey: await this.apiKeys.verify(apiKey) };
        return true;
      }
      if (strategy.type === "user" && scheme === "Bearer" && token) {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token).catch(() => {
          throw new UnauthorizedException("invalid or expired token");
        });
        if (!hasRole(payload.role, strategy.roles)) throw new ForbiddenException("insufficient role");
        request.auth = { type: "user", user: { id: payload.sub, role: payload.role } };
        return true;
      }
    }
    if (!strategies.length) return true;
    throw new UnauthorizedException("missing credentials");
  }
}
