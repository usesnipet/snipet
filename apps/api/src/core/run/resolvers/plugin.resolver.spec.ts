import { Driver } from "#src/core/manifest/driver.js";
import { HookAction, HookName, LLMMessagePartType, pluginManifestSchema } from "@snipet/shared/core";
import { z } from "zod";

import { PluginDriverRegistry } from "../../plugin/plugin.registry.js";

import { PluginResolver } from "./plugin.resolver.js";

import type { Agent, AgentPluginConnection, AgentRun } from "@snipet/shared";
import type { HookEvent, HookResult, LLMToolResult, PluginManifest } from "@snipet/shared/core";
import type { CoreContext } from "../../context.js";
import type { HookDriver, ToolDriver } from "../../plugin/driver.js";
import type { PluginManifestRegistry } from "../../plugin/plugin.registry.js";
import type { PluginConnectionStore, RunPluginConnection } from "../../store/plugin-connection.store.js";

const ctx = { owner: { userId: "u1", appId: null, externalUserId: null, name: null }, requestId: "q1" } as CoreContext;
const run = { id: "r1", sessionId: "s1", createdAt: new Date("2026-10-16T14:32:05.123Z") } as AgentRun;

/** Every call any fake driver saw, in order. */
let calls: string[] = [];

class FakeToolDriver extends Driver(z.object({ token: z.string().min(1) })) implements ToolDriver<{ token: string }> {
  readonly key = "fake-tools";
  listTools() {
    return Promise.resolve([]);
  }
  callTool(name: string, parameters: Record<string, unknown>, { token }: { token: string }): Promise<LLMToolResult> {
    calls.push(`${name} ${JSON.stringify(parameters)} ${token}`);
    return Promise.resolve({ content: name, isError: false });
  }
}

class FakeHookDriver extends Driver(z.object({})) implements HookDriver {
  readonly key = "fake-hooks";
  readonly hooks = [HookName.TOOL_BEFORE, HookName.RUN_START];
  handle(event: HookEvent): Promise<HookResult> {
    calls.push(`${event.hook} ${String(event.settings.who)}`);
    return Promise.resolve({ action: HookAction.CONTINUE });
  }
}

const manifests: Record<string, PluginManifest> = {
  tools: pluginManifestSchema.parse({
    key: "tools",
    name: "Tools",
    capabilities: { tools: { driver: "fake-tools", options: { token: "{{ connection.token }}" } } },
  }),
  hooks: pluginManifestSchema.parse({
    key: "hooks",
    name: "Hooks",
    capabilities: {
      hooks: {
        driver: "fake-hooks",
        handlers: { [HookName.TOOL_BEFORE]: {}, [HookName.RUN_START]: { optional: true } },
      },
    },
  }),
};

/** A connection to plugin `pluginKey`, with `tools` synced. */
function connection(id: string, pluginKey: string, extra: Partial<RunPluginConnection> = {}): RunPluginConnection {
  return { id, name: `Conn ${id}`, pluginKey, config: { token: `t-${id}` }, tools: [], instructions: null, ...extra };
}

/** A grant at `position`, of `tools`. */
function grant(pluginConnectionId: string, position: number, extra: Partial<AgentPluginConnection> = {}) {
  return {
    pluginConnectionId,
    position,
    tools: [],
    settings: { who: pluginConnectionId },
    disabledHooks: [],
    ...extra,
  };
}

const tool = (name: string) => ({ name, description: name, inputSchema: { type: "object" } });
/** The warnings logged. */
const warnings: unknown[] = [];
const logger = { log() {}, warn: (message: unknown) => void warnings.push(message), error() {} };

function resolverOf(connections: RunPluginConnection[]) {
  const store: PluginConnectionStore = {
    findEnabled: (_ctx, ids) =>
      Promise.resolve(new Map(connections.filter((c) => ids.includes(c.id)).map((c) => [c.id, c]))),
  };
  const registry = { find: (key: string) => manifests[key] } as unknown as PluginManifestRegistry;
  const drivers = new PluginDriverRegistry({
    tools: [new FakeToolDriver()],
    instructions: [],
    hooks: [new FakeHookDriver()],
    healthCheck: [],
  });
  return new PluginResolver(store, registry, drivers, logger);
}

const agentWith = (...grants: ReturnType<typeof grant>[]) => ({ pluginConnections: grants }) as unknown as Agent;

describe("PluginResolver", () => {
  beforeEach(() => {
    calls = [];
    warnings.length = 0;
  });

  it("offers the granted tools, runs them on their connection, and denies the rest", async () => {
    const resolver = resolverOf([
      connection("c1", "tools", { tools: [tool("search"), tool("delete")], instructions: "use search" }),
      connection("c2", "tools", { tools: [tool("delete")], instructions: "never shown" }),
    ]);
    const plugins = await resolver.resolve(ctx, {
      agent: agentWith(grant("c1", 0, { tools: ["search"] }), grant("c2", 1)),
      run,
    });

    expect(plugins.tools.tools.map((t) => t.name)).toEqual(["search"]);
    expect(plugins.denied).toEqual([
      { tool: "delete", pluginConnectionId: "c1" },
      { tool: "delete", pluginConnectionId: "c2" },
    ]);
    // Only connections with a granted tool bring their instructions.
    expect(plugins.instructions).toEqual([{ source: { id: "c1", name: "Conn c1" }, text: "use search" }]);

    const call = { type: LLMMessagePartType.TOOL_CALL as const, id: "x", name: "search", arguments: { q: "a" } };
    await expect(plugins.tools.call(call)).resolves.toEqual({ content: "search", isError: false });
    expect(calls).toEqual(['search {"q":"a"} t-c1']);
  });

  it("runs hooks in the grants' position order, minus optional ones the agent turned off", async () => {
    const resolver = resolverOf([connection("late", "hooks"), connection("early", "hooks")]);
    const plugins = await resolver.resolve(ctx, {
      agent: agentWith(grant("late", 2, { disabledHooks: [HookName.RUN_START] }), grant("early", 1)),
      run,
    });
    const call = { type: LLMMessagePartType.TOOL_CALL as const, id: "x", name: "t", arguments: {} };

    await plugins.hooks.run(HookName.TOOL_BEFORE, { call, tool: null });
    await plugins.hooks.run(HookName.RUN_START, { input: "hi" });
    expect(calls).toEqual(["tool.before early", "tool.before late", "run.start early"]);
  });

  it("leaves out, and logs, a connection whose plugin or driver options don't resolve", async () => {
    const resolver = resolverOf([
      connection("gone", "unknown-plugin"),
      connection("broken", "tools", { config: {}, tools: [tool("search")] }),
      connection("ok", "tools", { tools: [tool("search")] }),
    ]);
    const plugins = await resolver.resolve(ctx, {
      agent: agentWith(
        grant("gone", 0),
        grant("broken", 1, { tools: ["search"] }),
        grant("ok", 2, { tools: ["search"] }),
        grant("disabled", 3),
      ),
      run,
    });

    expect(plugins.tools.tools.map((t) => t.description)).toEqual(["[Conn ok] search"]);
    expect(warnings).toHaveLength(2);
  });
});
