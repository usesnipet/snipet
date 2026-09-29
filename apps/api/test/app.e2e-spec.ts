import { INestApplication } from "@nestjs/common";
import type { AuthResponse } from "@snipet/shared";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types.js";

// Runs against DATABASE_URL: use a dedicated database. The root user is
// created with this password when the users table is empty.
process.env.ROOT_PASSWORD ||= "e2e-root-password";
const { AppModule } = await import("./../src/app.module.js");

describe("App (e2e)", () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const login = async () => {
    const res = await http()
      .post("/auth/login")
      .send({ username: process.env.ROOT_USERNAME ?? "admin", password: process.env.ROOT_PASSWORD })
      .expect(200);
    return res.body as AuthResponse;
  };

  it("rejects requests without a token", async () => {
    await http().get("/widget").expect(401);
    await http().get("/widget").set("Authorization", "Bearer nope").expect(401);
  });

  it("rejects wrong credentials", () => {
    return http().post("/auth/login").send({ username: "admin", password: "wrong-password" }).expect(401);
  });

  it("logs in and uses the access token", async () => {
    const body = await login();
    expect(body.user).not.toHaveProperty("password");

    const auth = `Bearer ${body.accessToken}`;
    const me = await http().get("/auth/me").set("Authorization", auth).expect(200);
    expect(me.body).toMatchObject({ id: body.user.id, role: "admin" });
    expect(me.body).not.toHaveProperty("password");

    await http().get("/widget?take=1").set("Authorization", auth).expect(200);
  });

  it("rotates refresh tokens and revokes them on logout", async () => {
    const body = await login();

    const res = await http().post("/auth/refresh").send({ refreshToken: body.refreshToken }).expect(200);
    const refreshed = res.body as AuthResponse;
    // single use
    await http().post("/auth/refresh").send({ refreshToken: body.refreshToken }).expect(401);

    await http().post("/auth/logout").send({ refreshToken: refreshed.refreshToken }).expect(204);
    await http().post("/auth/refresh").send({ refreshToken: refreshed.refreshToken }).expect(401);
  });
});
