import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types.js";
import { AppModule } from "./../src/app.module.js";

describe("App (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it("GET /widget returns a page", () => {
    return request(app.getHttpServer())
      .get("/widget?take=1")
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ skip: 0, take: 1 }));
  });
});
