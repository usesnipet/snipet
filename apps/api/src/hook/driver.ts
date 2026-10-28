import type { BaseDriver } from "#src/manifest/driver.js";
import type { HealthCheckDriver } from "#src/manifest/health-check.js";
import type { HookEvent, HookResult } from "@snipet/shared";

export interface HookDriver<Opts = unknown> extends BaseDriver<Opts> {
  /** Runs the handler; throws on failure, timeout (`signal`) or an invalid reply. */
  handle(event: HookEvent, options: Opts, signal: AbortSignal): Promise<HookResult>;
}

/** Driver per capability, keyed by the manifest field that names it. */
export type HookDrivers = {
  handle: HookDriver;
  healthCheck: HealthCheckDriver;
};
