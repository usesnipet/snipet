import { driverOf } from "./manifest.registry.js";
import { resolveOptions } from "./options.js";

import type { BaseManifest, JsonObject } from "@snipet/shared";
import type { BaseDriver } from "./driver.js";

/**
 * Driver interface per capability; the keys are the manifest fields that
 * hold a driver, e.g. { actions: ActionDriver; healthCheck: HealthCheckDriver }.
 */
export type DriverTypes = Record<string, BaseDriver>;

/** Catalog of drivers per capability, fixed at startup. */
export class DriverRegistry<D extends DriverTypes> {
  private readonly maps = new Map<keyof D, Map<string, BaseDriver>>();

  constructor(drivers: { [K in keyof D]: D[K][] }) {
    for (const type of Object.keys(drivers) as (keyof D)[]) {
      const map = new Map<string, BaseDriver>();
      for (const d of drivers[type]) {
        if (map.has(d.key)) throw new Error(`${String(type)} driver "${d.key}" registered twice`);
        map.set(d.key, d);
      }
      this.maps.set(type, map);
    }
  }

  /** The capabilities this registry has drivers for. */
  types(): (keyof D)[] {
    return [...this.maps.keys()];
  }

  has(type: keyof D, key: string): boolean {
    return this.maps.get(type)?.has(key) ?? false;
  }

  get<K extends keyof D>(type: K, key: string): D[K] {
    const d = this.maps.get(type)?.get(key);
    if (!d) throw new Error(`${String(type)} driver "${key}" not found`);
    return d as D[K];
  }

  /**
   * The manifest's driver for `type` with its options resolved against the
   * connection, or undefined when the manifest doesn't have that capability.
   */
  resolve<K extends keyof D>(
    manifest: BaseManifest,
    type: K,
    connection: JsonObject,
  ): { driver: D[K]; options: ReturnType<D[K]["validateOptions"]> } | undefined {
    const ref = driverOf(manifest, type);
    if (!ref) return undefined;
    const driver = this.get(type, ref.driver);
    return { driver, options: resolveOptions(driver, ref, connection) as ReturnType<D[K]["validateOptions"]> };
  }
}
