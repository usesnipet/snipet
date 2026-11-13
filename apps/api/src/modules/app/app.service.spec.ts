import { AppContext } from "#src/common/context/app-context.js";
import { env } from "#src/env.js";
import { LayeredCache, MemoryStore } from "#src/infra/cache/index.js";
import { JwtService } from "@nestjs/jwt";
import { createAppSchema, issueAppTokenSchema } from "@snipet/shared";

import { ANONYMOUS_REFRESH_AUDIENCE, APP_TOKEN_AUDIENCE, APP_TOKEN_SECRET, AppService } from "./app.service.js";

import type { AppTokenPayload } from "@snipet/shared";
import type { EntityManager } from "typeorm";
import type { App } from "./app.entity.js";
/** A real in-memory cache, fresh per service so tests don't share entries. */
const memoryCache = () => new LayeredCache([new MemoryStore({ sweepMs: 0 })]);

const ctx = AppContext.create("test");

/** A manager whose every repository is `repo`. */
const managerOf = (repo: object) => ({ getRepository: () => repo }) as unknown as EntityManager;

function setup() {
  // Same registration as AuthModule, so the access-token secret is the default.
  const jwt = new JwtService({ secret: env.JWT_SECRET });
  // Stand-in for the repository write, which updateById reaches only when its checks pass.
  const repo = { update: () => Promise.resolve({ affected: 1 }) };
  const service = new AppService(managerOf(repo), jwt, memoryCache());
  service.findById = (_ctx: AppContext, id: string) => Promise.resolve({ id, name: "Shop" } as App);
  return { jwt, service };
}

const appId = "app-1";

describe("AppService.issueToken", () => {
  it("signs the end user and the API key's app into the token", async () => {
    const { jwt, service } = setup();
    const dto = issueAppTokenSchema.parse({ externalUserId: "u-42", name: "Ana", email: "ana@shop.com" });

    const { token, expiresAt } = await service.issueToken(ctx, appId, dto);
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

    const { token } = await service.issueToken(ctx, appId, dto);
    const payload = await jwt.verifyAsync<AppTokenPayload>(token, {
      secret: APP_TOKEN_SECRET,
      audience: APP_TOKEN_AUDIENCE,
    });

    expect(payload.user).toEqual({});
  });

  it("rejects an API key from another app", async () => {
    const { service } = setup();
    const dto = issueAppTokenSchema.parse({ externalUserId: "u-42", appId: "00000000-0000-4000-8000-000000000000" });

    await expect(service.issueToken(ctx, appId, dto)).rejects.toThrow("API key does not belong to this app");
  });

  // The global AuthGuard verifies with JWT_SECRET; an app token must never pass it.
  it("can't be verified as a dashboard access token", async () => {
    const { jwt, service } = setup();
    const { token } = await service.issueToken(ctx, appId, issueAppTokenSchema.parse({ externalUserId: "u-42" }));

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
    };
    return { jwt, service: new AppService(managerOf(repo), jwt, memoryCache()) };
  }

  const verifyAccess = (jwt: JwtService, token: string) =>
    jwt.verifyAsync<AppTokenPayload>(token, { secret: APP_TOKEN_SECRET, audience: APP_TOKEN_AUDIENCE });

  it("creates a new anonymous end user, then keeps it across refreshes", async () => {
    const { jwt, service } = setupPublic();

    const first = await service.issueAnonymousToken(ctx, appId, origin);
    const firstSub = (await verifyAccess(jwt, first.token)).sub;
    expect(firstSub).toMatch(/^anon:/);

    const refreshed = await service.issueAnonymousToken(ctx, appId, origin, first.refreshToken);
    expect((await verifyAccess(jwt, refreshed.token)).sub).toBe(firstSub);

    const other = await service.issueAnonymousToken(ctx, appId, origin);
    expect((await verifyAccess(jwt, other.token)).sub).not.toBe(firstSub);
  });

  it("rejects an origin outside allowedOrigins, or none", async () => {
    const { service } = setupPublic();

    await expect(service.issueAnonymousToken(ctx, appId, "https://evil.com")).rejects.toThrow("origin not allowed");
    await expect(service.issueAnonymousToken(ctx, appId, undefined)).rejects.toThrow("origin not allowed");
  });

  it("hides apps without allowAnonymous", async () => {
    const { service } = setupPublic({ allowAnonymous: false });

    await expect(service.issueAnonymousToken(ctx, appId, origin)).rejects.toThrow("App not found");
  });

  it("rejects a refresh token from another app, or an access token as refresh", async () => {
    const { jwt, service } = setupPublic();
    const foreign = await jwt.signAsync(
      { sub: "anon:x", app: { id: "app-2" } },
      { secret: APP_TOKEN_SECRET, audience: ANONYMOUS_REFRESH_AUDIENCE },
    );
    const { token } = await service.issueAnonymousToken(ctx, appId, origin);

    await expect(service.issueAnonymousToken(ctx, appId, origin, foreign)).rejects.toThrow(
      "invalid or expired refresh token",
    );
    await expect(service.issueAnonymousToken(ctx, appId, origin, token)).rejects.toThrow(
      "invalid or expired refresh token",
    );
  });

  // The refresh token is long-lived: it must never work as an app token.
  it("refresh token can't be verified as an app token", async () => {
    const { jwt, service } = setupPublic();
    const { refreshToken } = await service.issueAnonymousToken(ctx, appId, origin);

    await expect(verifyAccess(jwt, refreshToken)).rejects.toThrow();
  });
});

describe("AppService allowAnonymous rule", () => {
  const origin = "https://shop.com";

  it("requires allowedOrigins on create", () => {
    expect(createAppSchema.safeParse({ name: "Shop", allowAnonymous: true }).success).toBe(false);
    expect(createAppSchema.safeParse({ name: "Shop", allowAnonymous: true, allowedOrigins: [origin] }).success).toBe(
      true,
    );
  });

  it("checks an update against the stored origins", async () => {
    const { service } = setup();
    const stored = { allowedOrigins: [] as string[] };
    service.findById = (_ctx: AppContext, id: string) =>
      Promise.resolve({ id, name: "Shop", ...stored } as unknown as App);

    await expect(service.updateById(ctx, appId, { allowAnonymous: true })).rejects.toThrow(
      "allowedOrigins is required",
    );
    stored.allowedOrigins = [origin];
    await expect(service.updateById(ctx, appId, { allowAnonymous: true })).resolves.toBeUndefined();
  });
});

describe("AppService.findAllowedOrigins", () => {
  it("caches the origins until the app is updated", async () => {
    const { service } = setup();
    let origins = ["https://shop.com"];
    let reads = 0;
    service.findById = (_ctx: AppContext, id: string) => {
      reads++;
      return Promise.resolve({ id, name: "Shop", allowedOrigins: origins } as App);
    };

    expect(await service.findAllowedOrigins(ctx, appId)).toEqual(["https://shop.com"]);
    expect(await service.findAllowedOrigins(ctx, appId)).toEqual(["https://shop.com"]);
    expect(reads).toBe(1);

    origins = ["https://new.shop.com"];
    await service.updateById(ctx, appId, { allowedOrigins: origins });
    expect(await service.findAllowedOrigins(ctx, appId)).toEqual(["https://new.shop.com"]);
  });

  it("doesn't cache a failed lookup", async () => {
    const { service } = setup();
    let fail = true;
    service.findById = (_ctx: AppContext, id: string) =>
      fail
        ? Promise.reject(new Error("db down"))
        : Promise.resolve({ id, allowedOrigins: ["https://shop.com"] } as App);

    await expect(service.findAllowedOrigins(ctx, appId)).rejects.toThrow("db down");
    fail = false;
    expect(await service.findAllowedOrigins(ctx, appId)).toEqual(["https://shop.com"]);
  });
});
