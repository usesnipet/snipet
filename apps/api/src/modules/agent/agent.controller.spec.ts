import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types.js";

import { AgentController } from "./agent.controller.js";
import { AgentService } from "./agent.service.js";

import type { INestApplication } from "@nestjs/common";

describe("AgentController", () => {
  let app: INestApplication<App>;
  const available = [{ id: "a1", name: "Helper", description: "", avatar: null }];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: { findAvailable: () => Promise.resolve(available) } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it("routes /agents/available to its handler, not the inherited /agents/:id", async () => {
    const response = await request(app.getHttpServer()).get("/agents/available").expect(200);
    expect(response.body).toEqual(available);
  });
});
