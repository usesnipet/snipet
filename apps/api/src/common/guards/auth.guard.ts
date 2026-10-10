import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { hasRole, Role } from "@snipet/shared";

import { ApiKeyService } from "../../modules/api-key/api-key.service.js";
import { APP_TOKEN_AUDIENCE, APP_TOKEN_SECRET } from "../../modules/app/app.service.js";
import { AUTH, AuthStrategy } from "../decorators/auth.decorator.js";

import type { JwtVerifyOptions } from "@nestjs/jwt";
import type { AppTokenPayload } from "@snipet/shared";
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

    // User and app tokens share the Bearer header but not the signing key: a
    // token that fails one is tried against the next strategy.
    for (const strategy of strategies) {
      if (strategy.type === "apiKey" && typeof apiKey === "string" && apiKey) {
        request.auth = { type: "apiKey", apiKey: await this.apiKeys.verify(apiKey) };
        return true;
      }
      if (strategy.type === "user" && scheme === "Bearer" && token) {
        const payload = await this.verify<AccessTokenPayload>(token, {});
        if (!payload) continue;
        if (!hasRole(payload.role, strategy.roles)) throw new ForbiddenException("insufficient role");
        request.auth = { type: "user", user: { id: payload.sub, role: payload.role } };
        return true;
      }
      if (strategy.type === "appToken" && scheme === "Bearer" && token) {
        const payload = await this.verify<AppTokenPayload>(token, {
          secret: APP_TOKEN_SECRET,
          audience: APP_TOKEN_AUDIENCE,
        });
        if (!payload) continue;
        request.auth = { type: "appToken", token: payload };
        return true;
      }
    }
    if (!strategies.length) return true;
    if (scheme === "Bearer" && token) throw new UnauthorizedException("invalid or expired token");
    throw new UnauthorizedException("missing credentials");
  }

  private async verify<T extends object>(token: string, options: JwtVerifyOptions): Promise<T | null> {
    return this.jwt.verifyAsync<T>(token, options).catch(() => null);
  }
}
