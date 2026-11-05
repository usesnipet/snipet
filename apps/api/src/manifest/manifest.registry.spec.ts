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

type Drivers = { tools: Echo; healthCheck: Echo };

const drivers = new DriverRegistry<Drivers>({ tools: [new Echo("mcp")], healthCheck: [new Echo("http")] });

const base = {
  name: "X",
  connection: { type: "object", properties: {} },
  capabilities: { tools: { driver: "mcp" } },
};

describe("ManifestRegistry", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "manifests-"));
    const files: Record<string, unknown> = {
      "b.json": { ...base, key: "beta", capabilities: { tools: { driver: "mcp" } } },
      "a.json": {
        ...base,
        key: "alpha",
        capabilities: { tools: { driver: "mcp" }, healthCheck: { driver: "http" } },
      },
      "dup.json": { ...base, key: "alpha" },
      "bad-key.json": { ...base, key: "Not A Key" },
      "unknown-driver.json": { ...base, key: "gamma", capabilities: { tools: { driver: "nope" } } },
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
    expect(registry.get("beta")).toMatchObject({
      description: "",
      tags: [],
      capabilities: { tools: { driver: "mcp", options: {} } },
    });
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
      capabilities: { tools: { driver: "mcp" } },
    });
    expect(secretFields(manifest.connection)).toEqual(["token"]);
  });
});
