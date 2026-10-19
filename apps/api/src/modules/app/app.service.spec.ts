import { JwtService } from "@nestjs/jwt";
import { issueAppTokenSchema } from "@snipet/shared";

import { env } from "#src/env.js";

import { ANONYMOUS_REFRESH_AUDIENCE, APP_TOKEN_AUDIENCE, APP_TOKEN_SECRET, AppService } from "./app.service.js";

import type { AppTokenPayload } from "@snipet/shared";
import type { Repository } from "typeorm";
import type { App } from "./app.entity.js";

function setup() {
  // Same registration as AuthModule, so the access-token secret is the default.
  const jwt = new JwtService({ secret: env.JWT_SECRET });
  const service = new AppService({} as Repository<App>, jwt);
  service.findById = (id: string) => Promise.resolve({ id, name: "Shop" } as App);
  return { jwt, service };
}

const appId = "app-1";

describe("AppService.issueToken", () => {
  it("signs the end user and the API key's app into the token", async () => {
    const { jwt, service } = setup();
    const dto = issueAppTokenSchema.parse({ externalUserId: "u-42", name: "Ana", email: "ana@shop.com" });

    const { token, expiresAt } = await service.issueToken(appId, dto);
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

    const { token } = await service.issueToken(appId, dto);
    const payload = await jwt.verifyAsync<AppTokenPayload>(token, {
      secret: APP_TOKEN_SECRET,
      audience: APP_TOKEN_AUDIENCE,
    });

    expect(payload.user).toEqual({});
  });

  it("rejects an API key from another app", async () => {
    const { service } = setup();
    const dto = issueAppTokenSchema.parse({ externalUserId: "u-42", appId: "00000000-0000-4000-8000-000000000000" });

    await expect(service.issueToken(appId, dto)).rejects.toThrow("API key does not belong to this app");
  });

  // The global AuthGuard verifies with JWT_SECRET; an app token must never pass it.
  it("can't be verified as a dashboard access token", async () => {
    const { jwt, service } = setup();
    const { token } = await service.issueToken(appId, issueAppTokenSchema.parse({ externalUserId: "u-42" }));

    await expect(jwt.verifyAsync(token)).rejects.toThrow();
  });
});

describe("AppService.issueAnonymousToken", () => {
  const origin = "https://shop.com";

  function setupPublic(app: Partial<App> = {}) {
    const jwt = new JwtService({ secret: env.JWT_SECRET });
    const stored = { id: appId, name: "Shop", allowAnonymous: true, allowedOrigins: [origin], ...app } as App;
    const repo = {
      findOneBy: ({ id, allowAnonymous }: Partial<App>) =>
        Promise.resolve(id === stored.id && allowAnonymous === stored.allowAnonymous ? stored : null),
    } as unknown as Repository<App>;
    return { jwt, service: new AppService(repo, jwt) };
  }

  const verifyAccess = (jwt: JwtService, token: string) =>
    jwt.verifyAsync<AppTokenPayload>(token, { secret: APP_TOKEN_SECRET, audience: APP_TOKEN_AUDIENCE });

  it("creates a new anonymous end user, then keeps it across refreshes", async () => {
    const { jwt, service } = setupPublic();

    const first = await service.issueAnonymousToken(appId, origin);
    const firstSub = (await verifyAccess(jwt, first.token)).sub;
    expect(firstSub).toMatch(/^anon:/);

    const refreshed = await service.issueAnonymousToken(appId, origin, first.refreshToken);
    expect((await verifyAccess(jwt, refreshed.token)).sub).toBe(firstSub);

    const other = await service.issueAnonymousToken(appId, origin);
    expect((await verifyAccess(jwt, other.token)).sub).not.toBe(firstSub);
  });

  it("rejects an origin outside allowedOrigins, or none", async () => {
    const { service } = setupPublic();

    await expect(service.issueAnonymousToken(appId, "https://evil.com")).rejects.toThrow("origin not allowed");
    await expect(service.issueAnonymousToken(appId, undefined)).rejects.toThrow("origin not allowed");
  });

  it("hides apps without allowAnonymous", async () => {
    const { service } = setupPublic({ allowAnonymous: false });

    await expect(service.issueAnonymousToken(appId, origin)).rejects.toThrow("App not found");
  });

  it("rejects a refresh token from another app, or an access token as refresh", async () => {
    const { jwt, service } = setupPublic();
    const foreign = await jwt.signAsync(
      { sub: "anon:x", app: { id: "app-2" } },
      { secret: APP_TOKEN_SECRET, audience: ANONYMOUS_REFRESH_AUDIENCE },
    );
    const { token } = await service.issueAnonymousToken(appId, origin);

    await expect(service.issueAnonymousToken(appId, origin, foreign)).rejects.toThrow(
      "invalid or expired refresh token",
    );
    await expect(service.issueAnonymousToken(appId, origin, token)).rejects.toThrow("invalid or expired refresh token");
  });

  // The refresh token is long-lived: it must never work as an app token.
  it("refresh token can't be verified as an app token", async () => {
    const { jwt, service } = setupPublic();
    const { refreshToken } = await service.issueAnonymousToken(appId, origin);

    await expect(verifyAccess(jwt, refreshToken)).rejects.toThrow();
  });
});

describe("AppService allowAnonymous rule", () => {
  it("requires allowedOrigins on create and on update", async () => {
    const { service } = setup();
    service.findById = (id: string) => Promise.resolve({ id, name: "Shop", allowedOrigins: [] } as unknown as App);

    expect(() => service.create({ name: "Shop", allowAnonymous: true })).toThrow("allowedOrigins is required");
    await expect(service.updateById(appId, { allowAnonymous: true })).rejects.toThrow("allowedOrigins is required");
  });
});
