import { jest } from "@jest/globals";

import { AppContext } from "#src/common/context/app-context.js";

import { SettingsService } from "./settings.service.js";

import type { EntityManager } from "typeorm";
import type { Setting } from "./settings.entity.js";

const ctx = AppContext.create("test");

function setup(rows: Partial<Setting>[]) {
  const repo = { find: jest.fn(() => Promise.resolve(rows)), upsert: jest.fn(() => Promise.resolve()) };
  return { repo, service: new SettingsService({ getRepository: () => repo } as unknown as EntityManager) };
}

describe("SettingsService", () => {
  it("drops stored keys of settings that no longer exist", async () => {
    expect(await setup([{ key: "agentDebugEnabled", value: true }]).service.get(ctx)).toEqual({});
  });

  it("doesn't write when nothing is sent", async () => {
    const { service, repo } = setup([]);
    await service.update(ctx, {});
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
