import { CoreError, CoreErrorCode } from "../error.js";
import { isValidJsonSchema } from "../json-schema/json-schema.js";

import type { BaseManifest, JsonObject, ManifestDriver } from "@snipet/shared";
import type { z } from "zod";
import type { Logger } from "../logger.js";
import type { DriverRegistry, DriverTypes } from "./driver.registry.js";

/** A manifest as read, before validation; `source` names where it came from, for logs. */
export interface ManifestSource {
  source: string;
  raw: unknown;
}

/** Reads the raw manifests of a kind (`name`: "plugin", "llm"). */
export type ManifestLoader = (name: string) => Promise<ManifestSource[]> | ManifestSource[];

/**
 * Catalog of manifests, filled by `init()` from the loader. A manifest that
 * fails its schema, repeats a key, names an unknown driver or has an invalid
 * connection schema is logged and skipped.
 */
export class ManifestRegistry<M extends BaseManifest, D extends DriverTypes> {
  private manifests = new Map<string, M>();

  constructor(
    private readonly name: string, // "plugin", "llm": used in logs and errors
    private readonly loader: ManifestLoader,
    private readonly schema: z.ZodType<M>,
    private readonly drivers: DriverRegistry<D>,
    private readonly logger: Logger,
  ) {}

  /** Loads and checks the manifests; call once before using the registry. */
  async init(): Promise<void> {
    const manifests = new Map<string, M>();
    for (const { source, raw } of await this.loader(this.name)) {
      const error = this.add(raw, manifests);
      if (error) this.logger.warn(`${this.name} manifest ${source}: ${error}`);
    }
    this.manifests = new Map([...manifests.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  getAll(): M[] {
    return [...this.manifests.values()];
  }

  get(key: string): M {
    const m = this.manifests.get(key);
    if (!m) throw new CoreError(CoreErrorCode.NOT_FOUND, `${this.name} "${key}" not found`);
    return m;
  }

  /** Adds `raw` to `manifests` when it's valid, or returns why it isn't. */
  private add(raw: unknown, manifests: Map<string, M>): string | undefined {
    const result = this.schema.safeParse(raw);
    if (!result.success) return result.error.message;
    const m = result.data;

    if (manifests.has(m.key)) return `key "${m.key}" registered twice`;
    for (const type of this.drivers.types()) {
      const ref = driverOf(m, type);
      if (ref && !this.drivers.has(type, ref.driver)) return `unknown ${String(type)} driver "${ref.driver}"`;
    }
    if (!isValidJsonSchema(m.connection)) return "invalid connection schema";
    const error = this.check(m, this.drivers);
    if (error) return error;
    manifests.set(m.key, m);
  }

  /** Checks specific to a kind of manifest, run once its drivers are known to exist; returns why it's rejected. */
  protected check(_manifest: M, _drivers: DriverRegistry<D>): string | undefined {
    return undefined;
  }
}

/** The manifest's driver for a capability, if it has one. */
export function driverOf(manifest: BaseManifest, type: PropertyKey): ManifestDriver | undefined {
  const { capabilities } = manifest as { capabilities?: Record<PropertyKey, ManifestDriver | undefined> };
  return capabilities?.[type];
}

/** Names of the properties of a JSON Schema (`connection`, `settings`) marked `secret: true`. */
export function secretFields(schema: JsonObject | undefined): string[] {
  const properties = (schema?.properties ?? {}) as Record<string, { secret?: boolean }>;
  return Object.keys(properties).filter((k) => properties[k]?.secret === true);
}
