import { jest } from "@jest/globals";

import { SettingsService } from "./settings.service.js";

import type { Repository } from "typeorm";
import type { Setting } from "./settings.entity.js";

function setup(rows: Partial<Setting>[]) {
  const repo = { find: jest.fn(() => Promise.resolve(rows)), upsert: jest.fn(() => Promise.resolve()) };
  return { repo, service: new SettingsService(repo as unknown as Repository<Setting>) };
}

describe("SettingsService", () => {
  it("returns stored values over the defaults and drops unknown keys", async () => {
    const { service } = setup([
      { key: "agentDebugEnabled", value: true },
      { key: "removedSetting", value: 1 },
    ]);
    expect(await service.get()).toEqual({ agentDebugEnabled: true });
  });

  it("falls back to the default of a setting not stored", async () => {
    expect(await setup([]).service.get()).toEqual({ agentDebugEnabled: false });
  });

  it("upserts only the keys sent", async () => {
    const { service, repo } = setup([]);
    await service.update({ agentDebugEnabled: true });
    expect(repo.upsert).toHaveBeenCalledWith([{ key: "agentDebugEnabled", value: true }], ["key"]);
    await service.update({});
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });
});
