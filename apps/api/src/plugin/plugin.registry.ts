import { DriverRegistry } from "#src/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/manifest/manifest.registry.js";

import type { PluginManifest } from "@snipet/shared";
import type { PluginDrivers } from "./driver.js";

// Named subclasses so Nest can inject them by class.
export class PluginDriverRegistry extends DriverRegistry<PluginDrivers> {}
export class PluginRegistry extends ManifestRegistry<PluginManifest, PluginDrivers> {}
