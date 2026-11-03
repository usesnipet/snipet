import { DriverRegistry } from "#src/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/manifest/manifest.registry.js";
import { hookHandlersOf } from "@snipet/shared";

import type { PluginManifest } from "@snipet/shared";
import type { PluginDrivers } from "./driver.js";

/** Plugin drivers per capability; a named subclass so Nest can inject it by class. */
export class PluginDriverRegistry extends DriverRegistry<PluginDrivers> {}

/** Plugin manifests loaded at startup; a named subclass so Nest can inject it by class. */
export class PluginRegistry extends ManifestRegistry<PluginManifest, PluginDrivers> {
  /** Rejects handlers on hooks the hooks driver doesn't implement. */
  protected override check(manifest: PluginManifest, drivers: DriverRegistry<PluginDrivers>): string | undefined {
    const hooks = manifest.capabilities.hooks;
    if (!hooks) return undefined;
    const implemented = drivers.get("hooks", hooks.driver).hooks;
    const missing = [...hookHandlersOf(hooks).keys()].filter((hook) => !implemented.includes(hook));
    return missing.length ? `hooks driver "${hooks.driver}" doesn't implement ${missing.join(", ")}` : undefined;
  }
}
