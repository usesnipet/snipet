import { DriverRegistry } from "#src/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/manifest/manifest.registry.js";

import type { LlmManifest } from "@snipet/shared";
import type { LLMDrivers } from "./driver.js";

/** LLM drivers per capability; a named subclass so Nest can inject it by class. */
export class LLMDriverRegistry extends DriverRegistry<LLMDrivers> {}
/** LLM manifests loaded at startup; a named subclass so Nest can inject it by class. */
export class LLMRegistry extends ManifestRegistry<LlmManifest, LLMDrivers> {}
