import { jest } from "@jest/globals";
import { ALL_HOOKS, pluginManifestSchema } from "@snipet/shared";
import { z } from "zod";

import { Driver } from "#src/manifest/driver.js";
import { PluginDriverRegistry } from "#src/plugin/plugin.registry.js";

import { HookDispatcher } from "./hook.dispatcher.js";

import type { HookDriver } from "#src/plugin/driver.js";
import type { PluginConnectionService } from "../../plugin-connection/plugin-connection.service.js";
import type { HookRunnerContext } from "./hook.runner.js";
import type { HookEvent, HookName, HookResult } from "@snipet/shared";

class RecDriver extends Driver(z.object({})) implements HookDriver {
  readonly key = "rec";
  readonly hooks = ALL_HOOKS;
  handle = jest.fn<(event: HookEvent) => Promise<HookResult>>(() => Promise.resolve({ action: "continue" }));
}

const manifests = {
  audit: pluginManifestSchema.parse({
    key: "audit",
    name: "Audit",
    capabilities: { hooks: { driver: "rec", handlers: [{ hook: ALL_HOOKS, background: true, optional: true }] } },
  }),
  guard: pluginManifestSchema.parse({
    key: "guard",
    name: "Guard",
    capabilities: { hooks: { driver: "rec", handlers: [{ hook: "tool.before", actions: ["deny"] }] } },
  }),
  tools: pluginManifestSchema.parse({
    key: "tools",
    name: "Tools",
    capabilities: { instructions: { driver: "static" } },
  }),
};

const conn = (id: string, pluginKey: keyof typeof manifests) => ({ id, name: id, pluginKey, config: {} });
const grant = (pluginConnectionId: string, position: number, disabledHooks: HookName[] = []) => ({
  pluginConnectionId,
  position,
  settings: { from: pluginConnectionId },
  disabledHooks,
});

describe("HookDispatcher.forRun", () => {
  it("binds the hooks of the agent's plugins in position order, minus the optional ones turned off", async () => {
    const driver = new RecDriver();
    const plugins = {
      findEnabled: () =>
        Promise.resolve(
          new Map([
            ["c1", conn("c1", "audit")],
            ["c2", conn("c2", "guard")],
            ["c3", conn("c3", "tools")],
          ]),
        ),
      getManifest: (key: keyof typeof manifests) => manifests[key],
    } as unknown as PluginConnectionService;
    const drivers = new PluginDriverRegistry({ tools: [], instructions: [], hooks: [driver], healthCheck: [] });
    const agent = {
      id: "ag1",
      pluginConnections: [
        grant("c3", 0),
        // Required: disabling it does nothing.
        grant("c2", 2, ["tool.before"]),
        grant("c1", 1, ["llm.request", "tool.before"]),
        grant("gone", 3),
      ],
    };
    const runner = await new HookDispatcher(plugins, drivers).forRun({
      agent,
      run: { id: "r1" },
    } as unknown as HookRunnerContext);
    await runner.run("tool.before", { call: { type: "tool_call", id: "x", name: "t", arguments: {} }, tool: null });
    await runner.run("llm.response", {
      model: null,
      message: { role: "assistant", parts: [] },
      usage: null,
      skipped: [],
      durationMs: 0,
    });
    await runner.settle();

    const seen = driver.handle.mock.calls.map(([event]) => `${event.hook} ${JSON.stringify(event.settings)}`);
    expect(seen).toEqual(['tool.before {"from":"c2"}', 'llm.response {"from":"c1"}']);
  });

  it("leaves out a plugin that fails to load", async () => {
    const plugins = {
      findEnabled: () => Promise.resolve(new Map([["c1", conn("c1", "audit")]])),
      getManifest: () => {
        throw new Error("gone");
      },
    } as unknown as PluginConnectionService;
    const drivers = new PluginDriverRegistry({ tools: [], instructions: [], hooks: [], healthCheck: [] });
    const agent = { id: "ag1", pluginConnections: [grant("c1", 0)] };
    const runner = await new HookDispatcher(plugins, drivers).forRun({ agent } as unknown as HookRunnerContext);
    await expect(runner.run("run.start", { input: "hi" })).resolves.toEqual({
      action: "continue",
      payload: { input: "hi" },
    });
  });
});
