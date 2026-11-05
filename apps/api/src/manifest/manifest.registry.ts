import { Logger, NotFoundException } from "@nestjs/common";
import { checkJsonSchema } from "@snipet/server-common";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BaseManifest, JsonObject, ManifestDriver } from "@snipet/shared";
import type { z } from "zod";
import type { DriverRegistry, DriverTypes } from "./driver.registry.js";

/**
 * Catalog of manifests: every *.json in `dir`, loaded and checked at startup.
 * A manifest that fails to parse, repeats a key, names an unknown driver or
 * has an invalid connection schema is logged and skipped.
 */
export class ManifestRegistry<M extends BaseManifest, D extends DriverTypes> {
  private readonly logger: Logger;
  private readonly manifests: Map<string, M>;

  constructor(
    private readonly name: string, // "plugin", "llm": used in logs and errors
    dir: string,
    builtInDir: string,
    schema: z.ZodType<M>,
    drivers: DriverRegistry<D>,
  ) {
    this.logger = new Logger(`ManifestRegistry(${name})`);
    const manifests = new Map<string, M>();
    const loadFromDir = (dir: string) => {
      try {
        for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
          const where = join(dir, file);
          const error = this.load(where, schema, drivers, manifests);
          if (error) this.logger.warn(`${name} manifest ${where}: ${error}`);
        }
      } catch (error) {
        if (error instanceof Error) this.logger.warn(`${name} manifest ${dir}: ${error.message}`);
      }
    };
    loadFromDir(dir);
    loadFromDir(builtInDir);
    this.manifests = new Map([...manifests.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  getAll(): M[] {
    return [...this.manifests.values()];
  }

  get(key: string): M {
    const m = this.manifests.get(key);
    if (!m) throw new NotFoundException(`${this.name} "${key}" not found`);
    return m;
  }

  /** Adds the manifest at `where` to `manifests`, or returns why it can't. */
  private load(where: string, schema: z.ZodType<M>, drivers: DriverRegistry<D>, manifests: Map<string, M>) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(where, "utf8"));
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
    const result = schema.safeParse(raw);
    if (!result.success) return result.error.message;
    const m = result.data;

    if (manifests.has(m.key)) return `key "${m.key}" registered twice`;
    for (const type of drivers.types()) {
      const ref = driverOf(m, type);
      if (ref && !drivers.has(type, ref.driver)) return `unknown ${String(type)} driver "${ref.driver}"`;
    }
    if (!checkJsonSchema(m.connection)) return "invalid connection schema";
    const error = this.check(m, drivers);
    if (error) return error;
    manifests.set(m.key, m);
  }

  /** Checks specific to a kind of manifest, run once its drivers are known to exist; returns why it's rejected. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected check(manifest: M, drivers: DriverRegistry<D>): string | undefined {
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
