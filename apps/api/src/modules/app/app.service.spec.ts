import { JwtService } from "@nestjs/jwt";
import { issueAppTokenSchema } from "@snipet/shared";

import { env } from "../../env.js";

import { APP_TOKEN_AUDIENCE, APP_TOKEN_SECRET, AppService } from "./app.service.js";

import type { AppTokenPayload } from "@snipet/shared";
import type { Repository } from "typeorm";
import type { ApiKey } from "../api-key/api-key.entity.js";
import type { App } from "./app.entity.js";

function setup() {
  // Same registration as AuthModule, so the access-token secret is the default.
  const jwt = new JwtService({ secret: env.JWT_SECRET });
  const service = new AppService({} as Repository<App>, jwt);
  service.findById = (id: string) => Promise.resolve({ id, name: "Shop" } as App);
  return { jwt, service };
}

const apiKey = { appId: "app-1" } as ApiKey;

describe("AppService.issueToken", () => {
  it("signs the end user and the API key's app into the token", async () => {
    const { jwt, service } = setup();
    const dto = issueAppTokenSchema.parse({ externalUserId: "u-42", name: "Ana", email: "ana@shop.com" });

    const { token, expiresAt } = await service.issueToken(apiKey, dto);
    const payload = await jwt.verifyAsync<AppTokenPayload & { aud: string; exp: number }>(token, {
      secret: APP_TOKEN_SECRET,
      audience: APP_TOKEN_AUDIENCE,
    });

    expect(payload.sub).toBe("u-42");
    expect(payload.user).toEqual({ name: "Ana", email: "ana@shop.com" });
    expect(payload.app).toEqual({ id: "app-1", name: "Shop" });
    expect(Math.abs(payload.exp * 1000 - expiresAt.getTime())).toBeLessThan(2000);
  });

  it("drops empty name and email", async () => {
    const { jwt, service } = setup();
    const dto = issueAppTokenSchema.parse({ externalUserId: "u-42", name: "", email: "" });

    const { token } = await service.issueToken(apiKey, dto);
    const payload = await jwt.verifyAsync<AppTokenPayload>(token, { secret: APP_TOKEN_SECRET, audience: APP_TOKEN_AUDIENCE });

    expect(payload.user).toEqual({});
  });

  // The global AuthGuard verifies with JWT_SECRET; an app token must never pass it.
  it("can't be verified as a dashboard access token", async () => {
    const { jwt, service } = setup();
    const { token } = await service.issueToken(apiKey, issueAppTokenSchema.parse({ externalUserId: "u-42" }));

    await expect(jwt.verifyAsync(token)).rejects.toThrow();
  });
});
