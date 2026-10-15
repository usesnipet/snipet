import { NotFoundException } from "@nestjs/common";
import { pluginManifestSchema } from "@snipet/shared";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { Driver } from "./driver.js";
import { DriverRegistry } from "./driver.registry.js";
import { ManifestRegistry, secretFields } from "./manifest.registry.js";

class Echo extends Driver(z.object({})) {
  constructor(readonly key: string) {
    super();
  }
}

type Drivers = { actions: Echo; healthCheck: Echo };

const drivers = new DriverRegistry<Drivers>({ actions: [new Echo("mcp")], healthCheck: [new Echo("http")] });

const base = { name: "X", connection: { type: "object", properties: {} } };

describe("ManifestRegistry", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "manifests-"));
    const files: Record<string, unknown> = {
      "b.json": { ...base, key: "beta", actions: { driver: "mcp" } },
      "a.json": { ...base, key: "alpha", healthCheck: { driver: "http" } },
      "dup.json": { ...base, key: "alpha" },
      "bad-key.json": { ...base, key: "Not A Key" },
      "unknown-driver.json": { ...base, key: "gamma", actions: { driver: "nope" } },
      "bad-schema.json": { ...base, key: "delta", connection: { type: "nope" } },
      "ignored.txt": "not a manifest",
    };
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(dir, file), typeof content === "string" ? content : JSON.stringify(content));
    }
    writeFileSync(join(dir, "broken.json"), "{");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("loads only the valid manifests, sorted by key", () => {
    const registry = new ManifestRegistry("plugin", dir, dir, pluginManifestSchema, drivers);
    expect(registry.getAll().map((m) => m.key)).toEqual(["alpha", "beta"]);
  });

  it("applies the schema defaults", () => {
    const registry = new ManifestRegistry("plugin", dir, dir, pluginManifestSchema, drivers);
    expect(registry.get("beta")).toMatchObject({ description: "", tags: [], actions: { driver: "mcp", options: {} } });
  });

  it("throws NotFoundException for an unknown key", () => {
    const registry = new ManifestRegistry("plugin", dir, dir, pluginManifestSchema, drivers);
    expect(() => registry.get("gamma")).toThrow(NotFoundException);
    expect(() => registry.get("gamma")).toThrow('plugin "gamma" not found');
  });
});

describe("secretFields", () => {
  it("lists the connection properties marked secret", () => {
    const manifest = pluginManifestSchema.parse({
      key: "xx",
      name: "X",
      connection: {
        type: "object",
        properties: { url: { type: "string" }, token: { type: "string", secret: true } },
      },
    });
    expect(secretFields(manifest)).toEqual(["token"]);
  });
});
