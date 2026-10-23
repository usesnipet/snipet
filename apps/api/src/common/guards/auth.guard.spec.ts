import { APP_TOKEN_AUDIENCE, APP_TOKEN_SECRET } from "#src/modules/app/app.service.js";
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@snipet/shared";

import { ApiKeyAuth, AppTokenAuth, Private, Public, UserAuth } from "../decorators/auth.decorator.js";

import { AuthGuard } from "./auth.guard.js";
import { ApiKeyStrategy } from "./strategies/api-key.strategy.js";
import { AppTokenStrategy } from "./strategies/app-token.strategy.js";
import { UserStrategy } from "./strategies/user.strategy.js";

import type { ApiKeyService } from "#src/modules/api-key/api-key.service.js";
import type { AppService } from "#src/modules/app/app.service.js";

const jwt = new JwtService({ secret: "test" });
const apiKeys = { verify: (key: string) => Promise.resolve({ id: key, appId: "app-1" }) } as unknown as ApiKeyService;
const allowedOrigins = ["https://shop.com"];
const apps = { findAllowedOrigins: () => Promise.resolve(allowedOrigins) } as unknown as AppService;
const guard = new AuthGuard(
  new Reflector(),
  new UserStrategy(jwt),
  new ApiKeyStrategy(apiKeys),
  new AppTokenStrategy(jwt, apps),
);

// Builds a route from class/method decorators and runs the guard with headers.
function run(
  decorators: { cls?: ClassDecorator & MethodDecorator; method?: ClassDecorator & MethodDecorator },
  headers: Record<string, string> = {},
) {
  class Controller {
    handler() {}
  }
  decorators.cls?.(Controller);
  if (decorators.method) {
    const descriptor = Object.getOwnPropertyDescriptor(Controller.prototype, "handler")!;
    decorators.method(Controller.prototype, "handler", descriptor);
  }
  const request: Record<string, unknown> = { headers };
  const ctx = {
    getHandler: () => Object.getOwnPropertyDescriptor(Controller.prototype, "handler")!.value as () => void,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return guard.canActivate(ctx).then(() => request.auth);
}

const bearer = (role: Role) => ({ authorization: `Bearer ${jwt.sign({ sub: "u-1", role })}` });
const appToken = {
  authorization: `Bearer ${jwt.sign(
    { sub: "end-user", user: {}, app: { id: "app-1", name: "Shop" } },
    { secret: APP_TOKEN_SECRET, audience: APP_TOKEN_AUDIENCE },
  )}`,
};

describe("AuthGuard", () => {
  it("denies routes without @Public or @Private", async () => {
    await expect(run({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets @Public routes through without credentials", async () => {
    await expect(run({ cls: Public() })).resolves.toBeUndefined();
  });

  it("accepts a user with an allowed role", async () => {
    await expect(run({ cls: Private(UserAuth(Role.Admin)) }, bearer(Role.Admin))).resolves.toEqual({
      type: "user",
      user: { id: "u-1", role: Role.Admin, name: null },
    });
  });

  it("rejects a user without an allowed role", async () => {
    const roles = Object.values(Role).filter((r) => r !== Role.Admin);
    await expect(run({ cls: Private(UserAuth(Role.Admin)) }, bearer(roles[0]))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("accepts an API key when the route allows it", async () => {
    await expect(run({ cls: Private(UserAuth(), ApiKeyAuth()) }, { "x-api-key": "k" })).resolves.toMatchObject({
      type: "apiKey",
    });
  });

  it("method decorators override the class's", async () => {
    const route = { cls: Private(UserAuth(), ApiKeyAuth()), method: Private(ApiKeyAuth()) };
    await expect(run(route, bearer(Role.Admin))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(run({ cls: Private(UserAuth()), method: Public() })).resolves.toBeUndefined();
  });

  it("rejects an invalid token", async () => {
    await expect(run({ cls: Private(UserAuth()) }, { authorization: "Bearer nope" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("accepts an app token after a user strategy rejects it", async () => {
    await expect(run({ cls: Private(UserAuth(Role.Admin), AppTokenAuth()) }, appToken)).resolves.toMatchObject({
      type: "appToken",
      token: { sub: "end-user", app: { id: "app-1" } },
    });
  });

  it("app tokens and user tokens don't pass for each other", async () => {
    await expect(run({ cls: Private(UserAuth()) }, appToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(run({ cls: Private(AppTokenAuth()) }, bearer(Role.Admin))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("checks a browser's Origin against the app's allowedOrigins", async () => {
    const route = { cls: Private(AppTokenAuth()) };
    await expect(run(route, { ...appToken, origin: "https://shop.com" })).resolves.toMatchObject({ type: "appToken" });
    await expect(run(route, { ...appToken, origin: "https://evil.com" })).rejects.toBeInstanceOf(ForbiddenException);
    // Servers send no Origin.
    await expect(run(route, appToken)).resolves.toMatchObject({ type: "appToken" });
  });
});
