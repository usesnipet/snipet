import { DriverRegistry } from "#src/core/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/core/manifest/manifest.registry.js";
import { hookHandlersOf } from "@snipet/shared";

import type { PluginManifest } from "@snipet/shared";
import type { PluginDrivers } from "./driver.js";

/** Plugin drivers per capability; a named subclass so Nest can inject it by class. */
export class PluginDriverRegistry extends DriverRegistry<PluginDrivers> {}

/** Plugin manifests loaded at startup; a named subclass so Nest can inject it by class. */
export class PluginManifestRegistry extends ManifestRegistry<PluginManifest, PluginDrivers> {
  /** Rejects handlers on hooks the hooks driver doesn't implement. */
  protected override check(manifest: PluginManifest): string | undefined {
    const hookCapability = manifest.capabilities.hooks;
    if (!hookCapability) return undefined;
    const driver = this.drivers.get("hooks", hookCapability.driver);
    const implemented = driver.hooks;
    const missing = [...hookHandlersOf(hookCapability).keys()].filter((hook) => !implemented.includes(hook));
    return missing.length
      ? `hooks driver "${hookCapability.driver}" doesn't implement ${missing.join(", ")}`
      : undefined;
  }
}
