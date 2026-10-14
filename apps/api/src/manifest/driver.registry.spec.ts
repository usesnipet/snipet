import { z } from "zod";

import { Driver } from "./driver.js";
import { DriverRegistry } from "./driver.registry.js";

import type { BaseManifest } from "@snipet/shared";

class Echo extends Driver(z.strictObject({ url: z.string() })) {
  constructor(readonly key: string) {
    super();
  }
}

type Drivers = { actions: Echo; healthCheck: Echo };

const manifest = (extra: object) =>
  ({
    key: "m",
    name: "M",
    description: "",
    tags: [],
    auth: { type: "none" },
    connection: {},
    ...extra,
  }) as BaseManifest;

describe("DriverRegistry", () => {
  const registry = new DriverRegistry<Drivers>({ actions: [new Echo("mcp")], healthCheck: [new Echo("http")] });

  it("finds drivers by capability and key", () => {
    expect(registry.types()).toEqual(["actions", "healthCheck"]);
    expect(registry.has("actions", "mcp")).toBe(true);
    expect(registry.has("actions", "http")).toBe(false);
    expect(registry.get("healthCheck", "http").key).toBe("http");
    expect(() => registry.get("actions", "http")).toThrow('actions driver "http" not found');
  });

  it("rejects a key registered twice for the same capability", () => {
    expect(() => new DriverRegistry<Drivers>({ actions: [new Echo("a"), new Echo("a")], healthCheck: [] })).toThrow(
      'actions driver "a" registered twice',
    );
  });

  it("resolves a manifest driver with its options rendered from the connection", () => {
    const m = manifest({ actions: { driver: "mcp", options: { url: "{{ connection.url }}/mcp" } } });
    const resolved = registry.resolve(m, "actions", { url: "https://x.dev" });
    expect(resolved?.driver.key).toBe("mcp");
    expect(resolved?.options).toEqual({ url: "https://x.dev/mcp" });
  });

  it("returns undefined when the manifest lacks the capability", () => {
    expect(registry.resolve(manifest({}), "healthCheck", {})).toBeUndefined();
  });

  it("throws when the rendered options are invalid", () => {
    const m = manifest({ actions: { driver: "mcp", options: { url: "{{ connection.url }}", extra: 1 } } });
    expect(() => registry.resolve(m, "actions", { url: "x" })).toThrow("invalid options");
  });
});
