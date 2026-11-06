import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types.js";

import { AgentController } from "./agent.controller.js";
import { AgentService } from "./agent.service.js";

import type { INestApplication } from "@nestjs/common";

describe("AgentController", () => {
  let app: INestApplication<App>;
  const available = [{ id: "a1", name: "Helper", description: "", avatar: null }];
  const summaries = { data: available, total: 1, skip: 0, take: 20 };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        {
          provide: AgentService,
          useValue: {
            findAvailable: () => Promise.resolve(available),
            findSummaries: () => Promise.resolve(summaries),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it("routes /agents/available to its handler, not the inherited /agents/:id", async () => {
    const response = await request(app.getHttpServer()).get("/agents/available").expect(200);
    expect(response.body).toEqual(available);
  });

  it("lists summaries instead of the inherited whole-agent listing", async () => {
    const response = await request(app.getHttpServer()).get("/agents").expect(200);
    expect(response.body).toEqual(summaries);
  });
});
