import { Test } from "@nestjs/testing";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";

import { PluginModule } from "./plugin.module.js";

describe("PluginModule", () => {
  it("loads every built-in manifest, each one's drivers registered", async () => {
    const app = await Test.createTestingModule({ imports: [PluginModule] }).compile();

    // A manifest naming an unregistered driver, or a hook its driver lacks, is
    // skipped by init(): so all of them loading means the drivers are wired.
    const builtIn = readdirSync(resolve(import.meta.dirname, "manifests"));
    const loaded = app
      .get(PluginManifestRegistry)
      .getAll()
      .map((m) => m.key);
    expect(loaded.length).toBeGreaterThanOrEqual(builtIn.length);
    expect(loaded).toEqual(expect.arrayContaining(["mcp", "debug-fs", "debug-s3"]));
  });
});
