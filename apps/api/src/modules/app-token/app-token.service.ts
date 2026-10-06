import { createHmac } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createAppTokenSchema, type AppTokenPayload, type AppTokenResponse } from "@snipet/shared";
import type { z } from "zod";

import { env } from "../../env.js";
import type { ApiKey } from "../api-key/api-key.entity.js";
import { AppService } from "../app/app.service.js";

export const APP_TOKEN_AUDIENCE = "app";

// Own key, derived from JWT_SECRET: the global AuthGuard verifies with
// JWT_SECRET, so an app token can never pass as a dashboard access token.
export const APP_TOKEN_SECRET = createHmac("sha256", env.JWT_SECRET).update("app-token").digest("hex");

@Injectable()
export class AppTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly apps: AppService,
  ) {}

  // Signs a token for one of the API key's app's end users.
  async create(apiKey: ApiKey, dto: z.output<typeof createAppTokenSchema>): Promise<AppTokenResponse> {
    const app = await this.apps.findById(apiKey.appId);
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
