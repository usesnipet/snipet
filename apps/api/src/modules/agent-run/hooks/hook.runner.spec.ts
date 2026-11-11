import { hookHandlerSchema } from "@snipet/shared";

import { HookRunner, HookStoppedError } from "./hook.runner.js";

import type { HookContext, HookDriver } from "#src/core/plugin/driver.js";
import type { BoundHandler, HookRunnerContext } from "./hook.runner.js";
import type { HookEvent, HookResult } from "@snipet/shared";

const ctx = { run: { id: "r1" }, agent: { id: "ag1" }, owner: {} } as unknown as HookRunnerContext;
const call = { type: "tool_call" as const, id: "c1", name: "github_search", arguments: { q: "x" } };
const tool = { id: "p1", name: "GitHub" };

type Reply = (e: HookEvent<"tool.before">, context: HookContext) => Promise<HookResult> | HookResult;

/** A tool.before handler of plugin `name` that logs what it got and answers with reply. */
function handler(name: string, log: string[], reply: Reply, manifest: Record<string, unknown> = {}): BoundHandler {
  const driver = {
    handle: async (e: HookEvent<"tool.before">, _: unknown, context: HookContext) => {
      log.push(`${name} ${JSON.stringify(e.payload.call.arguments)} ${e.actions.join(",")}`);
      return reply(e, context);
    },
  } as unknown as HookDriver;
  return {
    plugin: { id: name, name },
    hook: "tool.before",
    handler: hookHandlerSchema.parse({ hook: "tool.before", ...manifest }),
    driver,
    options: {},
    settings: { who: name },
  };
}

const modify =
  (q: string): Reply =>
  (e) => ({ action: "modify", payload: { call: { ...e.payload.call, arguments: { q } } } });
const ok = (): HookResult => ({ action: "continue" });
const modifier = { actions: ["modify"] };
const guard = { actions: ["deny", "stop"] };

describe("HookRunner.run", () => {
  it("orders by order then position, chaining the payload through modifiers", async () => {
    const log: string[] = [];
    const hooks = new HookRunner(
      [
        handler("a", log, modify("a"), modifier),
        handler("z", log, modify("z"), { ...modifier, order: "last" }),
        handler("b", log, modify("b"), modifier),
        handler("f", log, modify("f"), { ...modifier, order: "first" }),
      ],
      ctx,
    );
    const outcome = await hooks.run("tool.before", { call, tool });

    expect(log).toEqual(['f {"q":"x"} modify', 'a {"q":"f"} modify', 'b {"q":"a"} modify', 'z {"q":"b"} modify']);
    expect(outcome).toEqual({ action: "continue", payload: { call: { ...call, arguments: { q: "z" } }, tool } });
  });

  it("runs guards in parallel, the first deny cancelling the rest and ending the step", async () => {
    const log: string[] = [];
    let slowAborted = false;
    const slow: Reply = (_, { signal }) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", () => {
          slowAborted = true;
          resolve({ action: "continue" });
        }),
      );
    const hooks = new HookRunner(
      [
        handler("slow", log, slow, guard),
        handler("deny", log, () => ({ action: "deny", reason: "no" }), guard),
        handler("later", log, ok, modifier),
      ],
      ctx,
    );

    expect(await hooks.run("tool.before", { call, tool })).toEqual({ action: "deny", reason: "no" });
    expect(slowAborted).toBe(true);
    expect(log).toEqual(['slow {"q":"x"} deny,stop', 'deny {"q":"x"} deny,stop']);
  });

  it("throws HookStoppedError on stop", async () => {
    const hooks = new HookRunner([handler("a", [], () => ({ action: "stop", reason: "off" }), guard)], ctx);
    await expect(hooks.run("tool.before", { call, tool })).rejects.toEqual(new HookStoppedError("off"));
  });

  it("treats a reply outside the handler's actions as a failure, handled per onFailure", async () => {
    const run = (onFailure: string) =>
      new HookRunner([handler("a", [], modify("a"), { ...guard, onFailure })], ctx).run("tool.before", {
        call,
        tool,
      });

    expect(await run("continue")).toEqual({ action: "continue", payload: { call, tool } });
    expect(await run("deny")).toEqual({ action: "deny", reason: 'plugin "a" failed' });
    await expect(run("stop")).rejects.toEqual(new HookStoppedError('plugin "a" failed'));
  });

  it("treats a payload that doesn't fit the hook as a failure", async () => {
    const bad: Reply = () => ({ action: "modify", payload: { call: { id: 1 } } });
    const hooks = new HookRunner([handler("a", [], bad, { ...modifier, onFailure: "deny" })], ctx);
    expect(await hooks.run("tool.before", { call, tool })).toEqual({ action: "deny", reason: 'plugin "a" failed' });
  });

  it("gives background handlers the final payload and no actions", async () => {
    const log: string[] = [];
    const hooks = new HookRunner(
      [handler("log", log, ok, { background: true }), handler("github", log, modify("g"), modifier)],
      ctx,
    );
    await hooks.run("tool.before", { call, tool });
    await hooks.settle();

    expect(log).toEqual(['github {"q":"x"} modify', 'log {"q":"g"} ']);
  });

  it("keeps each plugin's state across events, apart from the others'", async () => {
    const seen: string[] = [];
    const counter: Reply = (e, { state, settings }) => {
      seen.push(`${String(settings.who)} ${JSON.stringify(e.state)}`);
      return { action: "continue", state: { n: ((state.n as number) ?? 0) + 1 } };
    };
    const hooks = new HookRunner([handler("a", [], counter), handler("b", [], counter)], ctx);
    await hooks.run("tool.before", { call, tool });
    await hooks.run("tool.before", { call, tool });

    expect(seen).toEqual(["a {}", "b {}", 'a {"n":1}', 'b {"n":1}']);
  });
});
