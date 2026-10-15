import { Test } from "@nestjs/testing";
import { Readable } from "node:stream";
import request from "supertest";
import { App } from "supertest/types.js";

import { FilesController } from "./files.controller.js";
import { FilesStorage } from "./files.storage.js";

import type { INestApplication } from "@nestjs/common";

describe("FilesController", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const files = {
      get: (key: string) =>
        Promise.resolve(key === "agents/a.webp" ? { body: Readable.from([Buffer.from("img")]) } : null),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesStorage, useValue: files }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });
  afterAll(() => app.close());

  it("serves a file by its nested key", async () => {
    const res = await request(app.getHttpServer()).get("/api/files/agents/a.webp").expect(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.body).toEqual(Buffer.from("img"));
  });

  it("404s a missing file and 400s a bad key", async () => {
    await request(app.getHttpServer()).get("/api/files/agents/missing.webp").expect(404);
    await request(app.getHttpServer()).get("/api/files/agents/.hidden").expect(400);
  });
});
