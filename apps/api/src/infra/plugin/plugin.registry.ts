import { Logger } from "@nestjs/common";
import { checkJsonSchema } from "@snipet/server-common";
import { PluginManifest, pluginManifestSchema } from "@snipet/shared";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PluginNotFoundError } from "./errors.js";

import type { DriverRegistry } from "./driver.registry.js";
// Catalog of plugin manifests: every *.json in `dir`, loaded and checked at
// startup. Any errors are logged and the plugin is skipped.
export class PluginRegistry {
  private readonly logger = new Logger(PluginRegistry.name);
  private readonly plugins: Map<string, PluginManifest>;

  constructor(dir: string, drivers: DriverRegistry) {
    const plugins = new Map<string, PluginManifest>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const where = join(dir, file);
      const result = pluginManifestSchema.safeParse(JSON.parse(readFileSync(where, "utf8")));
      if (!result.success) {
        this.logger.warn(`plugin manifest ${where}: ${result.error.message}`);
        continue;
      }
      const p = result.data;

      if (plugins.has(p.key)) {
        this.logger.warn(`plugin manifest ${where}: key "${p.key}" registered twice`);
        continue;
      }
      if (p.actions && !drivers.hasActionDriver(p.actions.driver)) {
        this.logger.warn(`plugin manifest ${where}: unknown action driver "${p.actions.driver}"`);
        continue;
      }
      if (p.healthCheck && !drivers.hasHealthCheckDriver(p.healthCheck.driver)) {
        this.logger.warn(`plugin manifest ${where}: unknown health check driver "${p.healthCheck.driver}"`);
        continue;
      }
      if (!checkJsonSchema(p.connection)) {
        this.logger.warn(`plugin manifest ${where}: invalid connection schema`);
        continue;
      }
      plugins.set(p.key, p);
    }
    this.plugins = new Map([...plugins.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  getAll(): PluginManifest[] {
    return [...this.plugins.values()];
  }

  get(key: string): PluginManifest {
    const p = this.plugins.get(key);
    if (!p) throw new PluginNotFoundError(key);
    return p;
  }
}

// Names of the `connection` properties marked `secret: true`.
export function secretFields(manifest: PluginManifest): string[] {
  const properties = (manifest.connection.properties ?? {}) as Record<string, { secret?: boolean }>;
  return Object.keys(properties).filter((k) => properties[k]?.secret === true);
}
