import { ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService } from "@snipet/server-common";
import { createHmac } from "node:crypto";
import { Repository } from "typeorm";

import { env } from "../../env.js";

import { App } from "./app.entity.js";

import type { AppTokenPayload, AppTokenResponse, issueAppTokenSchema } from "@snipet/shared";
import type { z } from "zod";

export const APP_TOKEN_AUDIENCE = "app";

// Own key, derived from JWT_SECRET: the global AuthGuard verifies with
// JWT_SECRET, so an app token can never pass as a dashboard access token.
export const APP_TOKEN_SECRET = createHmac("sha256", env.JWT_SECRET).update("app-token").digest("hex");

@Injectable()
export class AppService extends CrudService<App> {
  constructor(
    @InjectRepository(App) repo: Repository<App>,
    private readonly jwt: JwtService,
  ) {
    super(repo);
  }

  // Signs a token for one of the API key's app's end users.
  async issueToken(appId: string, dto: z.output<typeof issueAppTokenSchema>): Promise<AppTokenResponse> {
    if (dto.appId && dto.appId !== appId) throw new ForbiddenException("API key does not belong to this app");
    const app = await this.findById(appId);
    const payload: AppTokenPayload = {
      sub: dto.externalUserId,
      user: { name: dto.name, email: dto.email, metadata: dto.metadata },
      app: { id: app.id, name: app.name },
    };
    const token = await this.jwt.signAsync(payload, {
      secret: APP_TOKEN_SECRET,
      audience: APP_TOKEN_AUDIENCE,
      expiresIn: dto.expiresInSeconds,
    });
    return { token, expiresAt: new Date(Date.now() + dto.expiresInSeconds * 1000) };
  }
}
