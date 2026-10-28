import { jest } from "@jest/globals";

import { SettingsService } from "./settings.service.js";

import type { Repository } from "typeorm";
import type { Setting } from "./settings.entity.js";

function setup(rows: Partial<Setting>[]) {
  const repo = { find: jest.fn(() => Promise.resolve(rows)), upsert: jest.fn(() => Promise.resolve()) };
  return { repo, service: new SettingsService(repo as unknown as Repository<Setting>) };
}

describe("SettingsService", () => {
  it("drops stored keys of settings that no longer exist", async () => {
    expect(await setup([{ key: "agentDebugEnabled", value: true }]).service.get()).toEqual({});
  });

  it("doesn't write when nothing is sent", async () => {
    const { service, repo } = setup([]);
    await service.update({});
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
