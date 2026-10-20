import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ApiKeyStrategy } from "./strategies/api-key.strategy.js";
import { AppTokenStrategy } from "./strategies/app-token.strategy.js";
import { AUTH, bearerToken } from "./strategies/auth-strategy.js";
import { UserStrategy } from "./strategies/user.strategy.js";

import type { Request } from "express";
import type { AuthStrategy, AuthStrategyHandler, RequestAuth } from "./strategies/auth-strategy.js";

/** Every strategy type has a handler, so adding a type without one fails to compile. */
type Handlers = { [T in AuthStrategy["type"]]: AuthStrategyHandler<T> };

/**
 * Global: @Public() routes pass; @Private(...) routes need a credential for one
 * of their strategies, tried in order (sets request.auth); anything else is
 * denied, so a forgotten decorator fails closed.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly handlers: Handlers;

  constructor(
    private readonly reflector: Reflector,
    user: UserStrategy,
    apiKey: ApiKeyStrategy,
    appToken: AppTokenStrategy,
  ) {
    this.handlers = { user, apiKey, appToken };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const strategies = this.reflector.getAllAndOverride<AuthStrategy[] | undefined>(AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!strategies) throw new ForbiddenException("route is neither @Public nor @Private");
    if (!strategies.length) return true;

    const request = context.switchToHttp().getRequest<Request & { auth?: RequestAuth }>();

    // User and app tokens share the Bearer header but not the signing key: a
    // token that fails one is tried against the next strategy.
    for (const strategy of strategies) {
      const handler = this.handlers[strategy.type] as AuthStrategyHandler<typeof strategy.type>;
      const auth = await handler.authenticate(request, strategy);
      if (auth) {
        request.auth = auth;
        return true;
      }
    }
    if (bearerToken(request)) throw new UnauthorizedException("invalid or expired token");
    throw new UnauthorizedException("missing credentials");
  }
}
