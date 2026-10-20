import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { APP_TOKEN_AUDIENCE, APP_TOKEN_SECRET, AppService } from "#src/modules/app/app.service.js";

import { bearerToken } from "./auth-strategy.js";

import type { AppTokenPayload } from "@snipet/shared";
import type { Request } from "express";
import type { AuthStrategyHandler, RequestAuth } from "./auth-strategy.js";

/**
 * An app's end users, e.g. the widget: a Bearer app token. From a browser
 * (Origin set) the origin must be one of the app's allowedOrigins, so a leaked
 * token can't be used from another site. Servers send no Origin and skip the
 * check; an app with no allowedOrigins isn't restricted.
 */
@Injectable()
export class AppTokenStrategy implements AuthStrategyHandler<"appToken"> {
  constructor(
    private readonly jwt: JwtService,
    private readonly apps: AppService,
  ) {}

  async authenticate(request: Request): Promise<RequestAuth | null> {
    const token = bearerToken(request);
    if (!token) return null;
    const payload = await this.jwt
      .verifyAsync<AppTokenPayload>(token, { secret: APP_TOKEN_SECRET, audience: APP_TOKEN_AUDIENCE })
      .catch(() => null);
    if (!payload) return null;

    const origin = request.headers.origin;
    if (origin) {
      // ponytail: one DB read per browser request, cache allowedOrigins by app id if it shows up in latency
      const app = await this.apps.findById(payload.app.id).catch(() => null);
      if (!app) throw new UnauthorizedException("app no longer exists");
      if (app.allowedOrigins.length && !app.allowedOrigins.includes(origin)) {
        throw new ForbiddenException("origin not allowed");
      }
    }
    return { type: "appToken", token: payload };
  }
}
