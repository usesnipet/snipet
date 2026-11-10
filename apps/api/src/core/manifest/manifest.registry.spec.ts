import { jest } from "@jest/globals";
import { pluginManifestSchema } from "@snipet/shared";
import { z } from "zod";

import { CoreError } from "../error.js";
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
  const warn = jest.fn();
  const logger = { log() {}, warn, error() {} };
  const sources: Record<string, unknown> = {
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
  };
  const loader = () => Object.entries(sources).map(([source, raw]) => ({ source, raw }));

  /** A registry already initialized from `loader`. */
  const create = async () => {
    const registry = new ManifestRegistry("plugin", loader, pluginManifestSchema, drivers, logger);
    await registry.init();
    return registry;
  };

  beforeEach(() => warn.mockClear());

  it("loads only the valid manifests, sorted by key, and logs the rest", async () => {
    const registry = await create();
    expect(registry.getAll().map((m) => m.key)).toEqual(["alpha", "beta"]);
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dup.json: key "alpha" registered twice'));
  });

  it("is empty until init", () => {
    const registry = new ManifestRegistry("plugin", loader, pluginManifestSchema, drivers, logger);
    expect(registry.getAll()).toEqual([]);
  });

  it("applies the schema defaults", async () => {
    const registry = await create();
    expect(registry.get("beta")).toMatchObject({
      description: "",
      tags: [],
      capabilities: { tools: { driver: "mcp", options: {} } },
    });
  });

  it("throws CoreError for an unknown key", async () => {
    const registry = await create();
    expect(() => registry.get("gamma")).toThrow(CoreError);
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
