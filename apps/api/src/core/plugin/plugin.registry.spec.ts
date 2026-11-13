import { Driver } from "#src/core/manifest/driver.js";
import {
  hooksCapabilitySchema,
  pluginManifestSchema,
  HookAction,
  HookMode,
  HookName,
  HookOnFailure,
} from "@snipet/shared/core";
import { z } from "zod";

import { PluginDriverRegistry, PluginManifestRegistry } from "./plugin.registry.js";

import type { HookResult } from "@snipet/shared/core";
import type { HookDriver } from "./driver.js";

/** The issue messages of a capability that fails to parse. */
const issuesOf = (handlers: Record<string, unknown>) =>
  hooksCapabilitySchema.safeParse({ driver: "dbg", handlers }).error?.issues.map((issue) => issue.message) ?? [];

describe("hooksCapabilitySchema", () => {
  it("applies the handler defaults, the timeout depending on the mode", () => {
    const { handlers } = hooksCapabilitySchema.parse({
      driver: "dbg",
      handlers: { [HookName.RUN_START]: {}, [HookName.RUN_END]: { mode: HookMode.BACKGROUND } },
    });
    expect(handlers[HookName.RUN_START]).toEqual({
      mode: HookMode.SEQUENTIAL,
      onFailure: HookOnFailure.CONTINUE,
      optional: false,
      timeoutMs: 5000,
    });
    expect(handlers[HookName.RUN_END]?.timeoutMs).toBe(30000);
  });

  it("needs at least one handler", () => {
    expect(issuesOf({})).toEqual(["no handlers"]);
  });

  it("rejects a hook that doesn't exist", () => {
    expect(issuesOf({ "tool.error": {} })).not.toEqual([]);
  });

  it("only allows onFailure deny on hooks that accept deny", () => {
    expect(issuesOf({ [HookName.TOOL_BEFORE]: { onFailure: HookOnFailure.DENY } })).toEqual([]);
    expect(issuesOf({ [HookName.TOOL_AFTER]: { onFailure: HookOnFailure.DENY } })).toEqual([
      'onFailure "deny" on tool.after',
    ]);
  });

  it("rejects a background handler whose failure isn't continue", () => {
    expect(issuesOf({ [HookName.TOOL_AFTER]: { mode: HookMode.BACKGROUND, onFailure: HookOnFailure.STOP } })).toEqual([
      'onFailure "stop" in background: nothing waits for it',
    ]);
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
  readonly hooks: HookName[] = [HookName.RUN_CONTEXT, HookName.RUN_END];
  handle(): Promise<HookResult> {
    return Promise.resolve({ action: HookAction.CONTINUE });
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
  const plugin = (key: string, hook: HookName) => ({
    key,
    name: key,
    capabilities: { hooks: { driver: "memory", handlers: { [hook]: {} } } },
  });

  it("skips a manifest with a handler on a hook its driver doesn't implement", async () => {
    const loader = () => [
      { source: "ok.json", raw: plugin("ok", HookName.RUN_CONTEXT) },
      { source: "bad.json", raw: plugin("bad", HookName.TOOL_BEFORE) },
    ];
    const registry = new PluginManifestRegistry("plugin", loader, pluginManifestSchema, drivers, logger);
    await registry.init();
    expect(registry.getAll().map((m) => m.key)).toEqual(["ok"]);
  });
});
