import { env } from "#src/env.js";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService } from "@snipet/server-common";
import { anonymousHasOrigins } from "@snipet/shared";
import { createHmac, randomUUID } from "node:crypto";
import { Repository } from "typeorm";

import { App } from "./app.entity.js";

import type {
  AnonymousTokenResponse,
  AppTokenPayload,
  AppTokenResponse,
  issueAppTokenSchema,
  UpdateApp,
} from "@snipet/shared";
import type { z } from "zod";

export const APP_TOKEN_AUDIENCE = "app";

/** Audience of anonymous refresh tokens: never accepted where an app token is. */
export const ANONYMOUS_REFRESH_AUDIENCE = "app-anonymous-refresh";

/**
 * Own key, derived from JWT_SECRET: the global AuthGuard verifies with
 * JWT_SECRET, so an app token can never pass as a dashboard access token.
 */
export const APP_TOKEN_SECRET = createHmac("sha256", env.JWT_SECRET).update("app-token").digest("hex");

const ANONYMOUS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const ANONYMOUS_REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days, renewed on every refresh

/** What an anonymous refresh token carries. */
type AnonymousRefreshPayload = { sub: string; app: { id: string } };

@Injectable()
export class AppService extends CrudService<App> {
  constructor(
    @InjectRepository(App) repo: Repository<App>,
    private readonly jwt: JwtService,
  ) {
    super(repo);
  }

  override async updateById(id: string, dto: UpdateApp): Promise<void> {
    // Either field alone can break the rule, so check against the stored app.
    if (
      (dto.allowAnonymous !== undefined || dto.allowedOrigins !== undefined) &&
      !anonymousHasOrigins({ ...(await this.findById(id)), ...dto })
    ) {
      throw new BadRequestException("allowedOrigins is required when allowAnonymous is on");
    }
    return super.updateById(id, dto);
  }

  /** Signs a token for one of the API key's app's end users. */
  async issueToken(appId: string, dto: z.output<typeof issueAppTokenSchema>): Promise<AppTokenResponse> {
    if (dto.appId && dto.appId !== appId) throw new ForbiddenException("API key does not belong to this app");
    const app = await this.findById(appId);
    return this.signAppToken(
      { sub: dto.externalUserId, user: { name: dto.name, email: dto.email, metadata: dto.metadata }, app },
      dto.expiresInSeconds,
    );
  }

  /**
   * An app with allowAnonymous on, called from one of its allowed origins.
   * Any other app is a 404, so private apps can't be probed.
   */
  async findPublic(id: string, origin: string | undefined): Promise<App> {
    const app = await this.repo.findOneBy({ id, allowAnonymous: true });
    if (!app) throw new NotFoundException("App not found");
    if (!origin || !app.allowedOrigins.includes(origin)) throw new ForbiddenException("origin not allowed");
    return app;
  }

  /**
   * Tokens for an anonymous end user: a new one, or the refresh token's (which
   * is rotated). The sub is always server-made, so a client can't pick whose
   * sessions it reads.
   */
  async issueAnonymousToken(
    id: string,
    origin: string | undefined,
    refreshToken?: string,
  ): Promise<AnonymousTokenResponse> {
    const app = await this.findPublic(id, origin);
    let sub = `anon:${randomUUID()}`;
    if (refreshToken) {
      const payload = await this.jwt
        .verifyAsync<AnonymousRefreshPayload>(refreshToken, {
          secret: APP_TOKEN_SECRET,
          audience: ANONYMOUS_REFRESH_AUDIENCE,
        })
        .catch(() => null);
      if (payload?.app.id !== app.id) throw new UnauthorizedException("invalid or expired refresh token");
      sub = payload.sub;
    }

    const refresh: AnonymousRefreshPayload = { sub, app: { id: app.id } };
    const [access, nextRefreshToken] = await Promise.all([
      this.signAppToken({ sub, user: {}, app }, ANONYMOUS_TOKEN_TTL_SECONDS),
      this.jwt.signAsync(refresh, {
        secret: APP_TOKEN_SECRET,
        audience: ANONYMOUS_REFRESH_AUDIENCE,
        expiresIn: ANONYMOUS_REFRESH_TTL_SECONDS,
      }),
    ]);
    return { ...access, refreshToken: nextRefreshToken };
  }

  private async signAppToken(
    { sub, user, app }: { sub: string; user: AppTokenPayload["user"]; app: App },
    expiresInSeconds: number,
  ): Promise<AppTokenResponse> {
    const payload: AppTokenPayload = { sub, user, app: { id: app.id, name: app.name } };
    const token = await this.jwt.signAsync(payload, {
      secret: APP_TOKEN_SECRET,
      audience: APP_TOKEN_AUDIENCE,
      expiresIn: expiresInSeconds,
    });
    return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }
}
