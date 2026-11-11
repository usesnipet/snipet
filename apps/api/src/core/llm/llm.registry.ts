import { DriverRegistry } from "#src/core/manifest/driver.registry.js";
import { ManifestRegistry } from "#src/core/manifest/manifest.registry.js";

import type { LlmManifest } from "@snipet/shared";
import type { LLMDrivers } from "./driver.js";

/** LLM drivers per capability; a named subclass so Nest can inject it by class. */
export class LLMDriverRegistry extends DriverRegistry<LLMDrivers> {}

/** LLM manifests loaded at startup; a named subclass so Nest can inject it by class. */
export class LLMManifestRegistry extends ManifestRegistry<LlmManifest, LLMDrivers> {}
