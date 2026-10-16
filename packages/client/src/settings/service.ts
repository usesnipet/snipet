import http from "../http";
import { settingsSchema, updateSettingsSchema } from "@snipet/shared";

import type { Settings, UpdateSettings } from "@snipet/shared";
import type { ServiceGetOptions, ServicePutOptions } from "../http";

const SETTINGS_URL = "/api/settings";

const get = async (opts: ServiceGetOptions<Settings> = {}): Promise<Settings> =>
  http.get({ url: SETTINGS_URL, schemas: { response: settingsSchema }, ...opts });

/** Updates settings; only the keys sent change. */
const update = async (body: UpdateSettings, opts: ServicePutOptions<UpdateSettings, void> = {}): Promise<void> =>
  http.put({ url: SETTINGS_URL, body, schemas: { body: updateSettingsSchema }, ...opts });

export const settingsService = { get, update };
