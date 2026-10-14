import { DriverRegistry } from "#src/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/manifest/manifest.registry.js";

import type { LlmManifest } from "@snipet/shared";
import type { LLMDrivers } from "./driver.js";

// Named subclasses so Nest can inject them by class.
export class LLMDriverRegistry extends DriverRegistry<LLMDrivers> {}
export class LLMRegistry extends ManifestRegistry<LlmManifest, LLMDrivers> {}
