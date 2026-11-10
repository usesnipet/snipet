import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";

import { AppContext } from "#src/common/context/app-context.js";

import { Setting } from "./settings.entity.js";

import type { Settings, UpdateSettings } from "@snipet/shared";

const DEFAULTS: Settings = {};

const entries = (settings: UpdateSettings) => Object.entries(settings).map(([key, value]) => ({ key, value }));

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  constructor(private readonly manager: EntityManager) {}

  /** The settings table, joining the context's transaction when there is one. */
  private repository(ctx: AppContext): Repository<Setting> {
    return (ctx.tx ?? this.manager).getRepository(Setting);
  }

  /** Saves the default of every setting not stored yet; stored values are kept. */
  async onApplicationBootstrap(): Promise<void> {
    const ctx = AppContext.create("bootstrap:settings");
    await this.repository(ctx).createQueryBuilder().insert().values(entries(DEFAULTS)).orIgnore().execute();
  }

  /** Every setting, stored value or default; rows of settings no longer in DEFAULTS are ignored. */
  async get(ctx: AppContext): Promise<Settings> {
    const settings: Record<string, unknown> = { ...DEFAULTS };
    for (const { key, value } of await this.repository(ctx).find()) if (key in DEFAULTS) settings[key] = value;
    return settings as Settings;
  }

  async update(ctx: AppContext, dto: UpdateSettings): Promise<void> {
    const rows = entries(dto);
    if (rows.length) await this.repository(ctx).upsert(rows, ["key"]);
  }
}
