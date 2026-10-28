import { DriverRegistry } from "#src/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/manifest/manifest.registry.js";

import type { HookManifest } from "@snipet/shared";
import type { HookDrivers } from "./driver.js";

/** Hook drivers per capability; a named subclass so Nest can inject it by class. */
export class HookDriverRegistry extends DriverRegistry<HookDrivers> {}
/** Hook manifests loaded at startup; a named subclass so Nest can inject it by class. */
export class HookRegistry extends ManifestRegistry<HookManifest, HookDrivers> {}
