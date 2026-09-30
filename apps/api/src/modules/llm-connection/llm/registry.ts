import { createHash } from "node:crypto";

import { BadRequestException } from "@nestjs/common";
import type { LlmConnectionOptions, LlmModel, LlmProviderInfo } from "@snipet/shared";

import { validateJson, type JsonSchema } from "../../../utils/json-schema/json-schema.js";
import { LlmError } from "./errors.js";
import type { LlmProvider } from "./provider.js";

// validateJson (fills schema defaults), rethrown as LlmError so the runner
// treats it as fatal bad input.
export function validateOptions<T>(schema: JsonSchema | undefined, data: unknown, what: string): T {
  try {
    return validateJson<T>(schema, data ?? {});
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    const { details } = err.getResponse() as { details?: { path: PropertyKey[]; message: string }[] };
    const issues = details?.map((i) => `${[what, ...i.path].join(".")}: ${i.message}`).join("; ");
    throw new LlmError("invalid_options", issues || `${what}: invalid`);
  }
}

// Catalog of provider drivers, fixed at startup.
export class LlmRegistry {
  private readonly providers = new Map<string, LlmProvider>();
  // ponytail: no TTL or size limit (the Go one had TTL 0 too); LRU if it grows.
  private readonly modelsCache = new Map<string, Promise<LlmModel[]>>();

  constructor(providers: LlmProvider[]) {
    for (const p of providers) {
      if (this.providers.has(p.info.key)) throw new Error(`llm provider "${p.info.key}" registered twice`);
      if (!p.generate && !p.stream) throw new Error(`llm provider "${p.info.key}" can neither generate nor stream`);
      this.providers.set(p.info.key, p);
    }
  }

  list(): LlmProviderInfo[] {
    return [...this.providers.values()].map((p) => p.info).sort((a, b) => a.key.localeCompare(b.key));
  }

  get(key: string): LlmProvider {
    const p = this.providers.get(key);
    if (!p) throw new LlmError("provider_not_found", `llm provider "${key}" not found`);
    return p;
  }

  // Validates the options against the provider's auth methods and config
  // schema, then health-checks. Returns the options with schema defaults applied.
  async connect(key: string, options: LlmConnectionOptions = {}): Promise<LlmProvider> {
    const p = this.get(key);
    validateAuth(p.info, options.auth);
    validateOptions(p.info.schemas.config, options.config, "config");
    await p.healthCheck?.(options);
    return p;
  }

  // Cached per provider + options; caching the promise also collapses concurrent misses.
  models(key: string, options: LlmConnectionOptions = {}): Promise<LlmModel[]> {
    const p = this.get(key);
    const cacheKey = `${key}\0${createHash("sha256").update(JSON.stringify(options)).digest("hex")}`;
    let models = this.modelsCache.get(cacheKey);
    if (!models) {
      models = p.models(options);
      this.modelsCache.set(cacheKey, models);
      models.catch(() => this.modelsCache.delete(cacheKey));
    }
    return models;
  }

  async hasModel(key: string, model: string, options?: LlmConnectionOptions): Promise<boolean> {
    return (await this.models(key, options)).some((m) => m.key === model);
  }
}

// Passes when any declared auth method accepts the section; no methods = no requirement.
function validateAuth(info: LlmProviderInfo, auth: unknown) {
  if (info.auth.length === 0 || info.auth.some((m) => m.type === "no-auth" || !m.data)) return;
  let lastError: unknown;
  for (const method of info.auth) {
    try {
      validateOptions(method.data, auth, "auth");
      return;
    } catch (err) {
      lastError = err;
    }
  }
  const message = lastError instanceof Error ? lastError.message : "no matching auth method";
  throw new LlmError("auth", message);
}
