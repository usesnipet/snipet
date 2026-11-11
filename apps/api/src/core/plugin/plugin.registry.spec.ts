import { Driver } from "#src/core/manifest/driver.js";
import { ALL_HOOKS, hookHandlersOf, hooksCapabilitySchema, pluginManifestSchema } from "@snipet/shared";
import { z } from "zod";

import { PluginDriverRegistry, PluginManifestRegistry } from "./plugin.registry.js";

import type { HookName, HookResult } from "@snipet/shared";
import type { HookDriver } from "./driver.js";

/** The issue messages of a capability that fails to parse. */
const issuesOf = (handlers: unknown[]) =>
  hooksCapabilitySchema.safeParse({ driver: "dbg", handlers }).error?.issues.map((issue) => issue.message) ?? [];

describe("hooksCapabilitySchema", () => {
  it("applies the handler defaults, the timeout depending on background", () => {
    const { handlers } = hooksCapabilitySchema.parse({
      driver: "dbg",
      handlers: [{ hook: "run.start" }, { hook: "run.end", background: true }],
    });
    expect(handlers[0]).toEqual({
      hook: "run.start",
      actions: [],
      background: false,
      onFailure: "continue",
      optional: false,
      timeoutMs: 5000,
      order: "default",
    });
    expect(handlers[1].timeoutMs).toBe(30000);
  });

  it("rejects two handlers on one hook, after expanding lists", () => {
    expect(issuesOf([{ hook: ["run.start", "run.end"] }, { hook: "run.end" }])).toEqual(["two handlers on run.end"]);
    expect(issuesOf([{ hook: ALL_HOOKS }, { hook: "tool.after" }])).toEqual(["two handlers on tool.after"]);
  });

  it("rejects actions the hook doesn't accept", () => {
    expect(issuesOf([{ hook: "run.start", actions: ["modify"] }])).toEqual(["run.start doesn't accept modify"]);
    expect(issuesOf([{ hook: ALL_HOOKS, actions: ["stop"] }])).toEqual(["run.end doesn't accept stop"]);
  });

  it("rejects background handlers with actions", () => {
    expect(issuesOf([{ hook: "tool.after", actions: ["modify"], background: true }])).toEqual([
      "a background handler can't have actions",
    ]);
  });

  it("only allows onFailure deny on tool.before", () => {
    expect(issuesOf([{ hook: "tool.before", onFailure: "deny" }])).toEqual([]);
    expect(issuesOf([{ hook: "tool.after", onFailure: "deny" }])).toEqual(['onFailure "deny" on tool.after']);
  });
});

describe("hookHandlersOf", () => {
  it("expands lists into one handler per hook, in loop order", () => {
    const capability = hooksCapabilitySchema.parse({
      driver: "dbg",
      handlers: [
        { hook: ["run.end", "run.start"], background: true },
        { hook: "llm.request", actions: ["modify"] },
      ],
    });
    const handlers = hookHandlersOf(capability);
    expect([...handlers.keys()]).toEqual(["run.start", "llm.request", "run.end"]);
    expect(handlers.get("llm.request")?.actions).toEqual(["modify"]);

    const all = hookHandlersOf(hooksCapabilitySchema.parse({ driver: "dbg", handlers: [{ hook: ALL_HOOKS }] }));
    expect(all.size).toBe(8);
  });
});

describe("pluginManifestSchema", () => {
  it("needs tools, instructions or hooks", () => {
    const result = pluginManifestSchema.safeParse({ key: "xx", name: "X", capabilities: {} });
    expect(result.error?.issues[0].message).toBe("a plugin needs tools, instructions or hooks");
  });
});

class MemoryDriver extends Driver(z.object({})) implements HookDriver {
  readonly key = "memory";
  readonly hooks: HookName[] = ["run.context", "run.end"];
  handle(): Promise<HookResult> {
    return Promise.resolve({ action: "continue" });
  }
}

describe("PluginManifestRegistry", () => {
  const logger = { log() {}, warn() {}, error() {} };
  const drivers = new PluginDriverRegistry({
    tools: [],
    instructions: [],
    hooks: [new MemoryDriver()],
    healthCheck: [],
  });
  const plugin = (key: string, hook: string) => ({
    key,
    name: key,
    capabilities: { hooks: { driver: "memory", handlers: [{ hook }] } },
  });

  it("skips a manifest with a handler on a hook its driver doesn't implement", async () => {
    const loader = () => [
      { source: "ok.json", raw: plugin("ok", "run.context") },
      { source: "bad.json", raw: plugin("bad", "tool.before") },
    ];
    const registry = new PluginManifestRegistry("plugin", loader, pluginManifestSchema, drivers, logger);
    await registry.init();
    expect(registry.getAll().map((m) => m.key)).toEqual(["ok"]);
  });
});
