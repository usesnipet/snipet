import { DriverRegistry } from "#src/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/manifest/manifest.registry.js";

import type { PluginManifest } from "@snipet/shared";
import type { PluginDrivers } from "./driver.js";

/** Plugin drivers per capability; a named subclass so Nest can inject it by class. */
export class PluginDriverRegistry extends DriverRegistry<PluginDrivers> {}
/** Plugin manifests loaded at startup; a named subclass so Nest can inject it by class. */
export class PluginRegistry extends ManifestRegistry<PluginManifest, PluginDrivers> {}
