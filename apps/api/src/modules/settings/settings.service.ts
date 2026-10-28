import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Setting } from "./settings.entity.js";

import type { Settings, UpdateSettings } from "@snipet/shared";

const DEFAULTS: Settings = {};

const entries = (settings: UpdateSettings) => Object.entries(settings).map(([key, value]) => ({ key, value }));

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  constructor(@InjectRepository(Setting) private readonly repo: Repository<Setting>) {}

  /** Saves the default of every setting not stored yet; stored values are kept. */
  async onApplicationBootstrap(): Promise<void> {
    await this.repo.createQueryBuilder().insert().values(entries(DEFAULTS)).orIgnore().execute();
  }

  /** Every setting, stored value or default; rows of settings no longer in DEFAULTS are ignored. */
  async get(): Promise<Settings> {
    const settings: Record<string, unknown> = { ...DEFAULTS };
    for (const { key, value } of await this.repo.find()) if (key in DEFAULTS) settings[key] = value;
    return settings as Settings;
  }

  async update(dto: UpdateSettings): Promise<void> {
    const rows = entries(dto);
    if (rows.length) await this.repo.upsert(rows, ["key"]);
  }
}
