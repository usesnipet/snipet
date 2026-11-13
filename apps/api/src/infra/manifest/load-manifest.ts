import { Logger } from "@nestjs/common";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ManifestLoader, ManifestSource } from "#src/core/manifest/manifest.registry.js";

/**
 * Loader of every *.json in `dirs`, parsed. Keeps the order of `dirs`, so on a
 * repeated key the earlier dir wins. Unreadable dirs and broken JSON are logged and skipped.
 */
export function loadManifests(dirs: string[]): ManifestLoader {
  return async (name) => {
    const logger = new Logger(`ManifestLoader(${name})`);

    const readDir = async (dir: string): Promise<ManifestSource[]> => {
      let files: string[];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
      } catch (err) {
        logger.warn(`${name} manifest ${dir}: ${(err as Error).message}`);
        return [];
      }
      const sources = await Promise.all(files.map((file) => readSource(join(dir, file))));
      return sources.filter((s) => s !== undefined);
    };

    const readSource = async (source: string): Promise<ManifestSource | undefined> => {
      try {
        return { source, raw: JSON.parse(await readFile(source, "utf8")) as unknown };
      } catch (err) {
        logger.warn(`${name} manifest ${source}: ${(err as Error).message}`);
        return undefined;
      }
    };

    return (await Promise.all(dirs.map(readDir))).flat();
  };
}
