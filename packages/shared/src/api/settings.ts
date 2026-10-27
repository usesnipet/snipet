import { z } from "zod";

/** Every system setting, by key. The API returns all of them, defaults filled in. */
export const settingsSchema = z.object({});
export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

/** Only the keys sent are updated; unknown keys are rejected. */
export const updateSettingsSchema = settingsSchema.partial().strict();
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
