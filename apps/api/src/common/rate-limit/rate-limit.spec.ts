import { Controller, HttpCode, Injectable, Post } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import request from "supertest";
import { App } from "supertest/types.js";

import { env } from "#src/env.js";

import { RateLimit, RateLimitModule } from "./rate-limit.js";

import type { CanActivate, ExecutionContext, INestApplication } from "@nestjs/common";

/** Stands in for AuthGuard: "X-Sub" makes the caller an app end user. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; auth?: unknown }>();
    const sub = req.headers["x-sub"];
    req.auth = sub ? { type: "appToken", token: { sub, app: { id: "app-1" } } } : { type: "apiKey" };
    return true;
  }
}

@Controller()
class TestController {
  @Post("signup")
  @HttpCode(200)
  @RateLimit("anonymous-signup")
  signup() {}

  @Post("run")
  @HttpCode(200)
  @RateLimit("agent-run")
  run() {}

  @Post("open")
  @HttpCode(200)
  open() {}
}

describe("RateLimit", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitModule],
      controllers: [TestController],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterEach(() => app.close());

  const post = (path: string, body?: object, sub?: string) => {
    const req = request(app.getHttpServer()).post(path);
    if (sub) req.set("X-Sub", sub);
    return req.send(body);
  };

  it("limits a route only by the throttlers it lists", async () => {
    for (let i = 0; i < env.ANONYMOUS_SIGNUPS_PER_IP_PER_HOUR; i++) await post("/signup").expect(200);

    await post("/signup").expect(429);
    await post("/signup", { refreshToken: "x" }).expect(200);
    // Without @RateLimit, no throttler counts (Nest's default would apply them all).
    for (let i = 0; i <= env.AGENT_RUNS_PER_END_USER_PER_MINUTE; i++) await post("/open", {}, "anon:a").expect(200);
  });

  it("limits runs per end user, not API keys", async () => {
    for (let i = 0; i < env.AGENT_RUNS_PER_END_USER_PER_MINUTE; i++) await post("/run", {}, "anon:a").expect(200);

    await post("/run", {}, "anon:a").expect(429);
    await post("/run", {}, "anon:b").expect(200);
    for (let i = 0; i <= env.AGENT_RUNS_PER_END_USER_PER_MINUTE; i++) await post("/run").expect(200);
  });
});
