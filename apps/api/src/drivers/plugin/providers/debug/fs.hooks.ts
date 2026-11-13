import { Driver } from "#src/core/manifest/driver.js";
import { ALL_HOOKS, HookAction } from "@snipet/shared/core";
import type { HookEvent, HookResult } from "@snipet/shared/core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";

import { debugPath, eventJson } from "./event-file.js";

import type { HookContext, HookDriver } from "#src/core/plugin/driver.js";

const optionsSchema = z.strictObject({
  dir: z.string().refine(isAbsolute, "must be an absolute path"),
});

type DebugFsOptions = z.infer<typeof optionsSchema>;

/**
 * Saves each event as a JSON file under a directory of the API's disk; only observes.
 * ponytail: any connection can write wherever the API process can; gate it
 * behind an env var before exposing it in cloud.
 */
export class DebugFsDriver extends Driver(optionsSchema) implements HookDriver<DebugFsOptions> {
  readonly key = "debug-fs";
  readonly hooks = ALL_HOOKS;

  async handle(event: HookEvent, { dir }: DebugFsOptions, { signal }: HookContext): Promise<HookResult> {
    const path = join(dir, debugPath(event));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, eventJson(event), { signal });
    return { action: HookAction.CONTINUE };
  }
}
