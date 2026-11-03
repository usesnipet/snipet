import { jest } from "@jest/globals";

import { HookRunner } from "./hook.runner.js";

import type { HookContext, HookDriver } from "#src/plugin/driver.js";
import type { HookHandler, HookRunnerContext } from "./hook.runner.js";
import type { HookEvent, HookResult } from "@snipet/shared";

const ctx = { run: { id: "r1" }, agent: { id: "ag1" }, owner: {} } as unknown as HookRunnerContext;
const call = { type: "tool_call" as const, id: "c1", name: "github_search", arguments: { q: "x" } };
const tool = { id: "p1", name: "GitHub" };

/** A tool.before handler that logs what it got and answers with reply. */
function handler(
  name: string,
  log: string[],
  reply: (e: HookEvent<"tool.before">, signal: AbortSignal) => Promise<HookResult> | HookResult,
  rest: Partial<HookHandler> = {},
): HookHandler {
  const driver = {
    handle: async (e: HookEvent<"tool.before">, _: unknown, { signal }: HookContext) => {
      log.push(`${name} ${JSON.stringify(e.payload.call.arguments)} ${e.actions.join(",")}`);
      return reply(e, signal);
    },
  } as unknown as HookDriver;
  return {
    name,
    event: "tool.before",
    global: false,
    stage: 0,
    async: false,
    onFailure: "continue",
    driver,
    options: {},
    timeoutMs: 1000,
    ...rest,
  };
}

const modify =
  (q: string) =>
  (e: HookEvent<"tool.before">): HookResult => ({
    action: "modify",
    payload: { call: { ...e.payload.call, arguments: { q } } },
  });
const ok = (): HookResult => ({ action: "continue" });

describe("HookRunner.call", () => {
  it("runs globals first, then stage by stage, each getting the payload the last one left", async () => {
    const log: string[] = [];
    const hooks = new HookRunner(
      [
        handler("global", log, modify("g"), { global: true, stage: 5 }),
        handler("a", log, modify("a"), { stage: 0 }),
        handler("b", log, ok, { stage: 1 }),
      ],
      ctx,
    );
    const outcome = await hooks.call("tool.before", { call, tool });

    expect(log).toEqual([
      'global {"q":"x"} modify,deny,respond,stop',
      'a {"q":"g"} modify,deny,respond,stop',
      'b {"q":"a"} modify,deny,respond,stop',
    ]);
    expect(outcome).toEqual({ action: "continue", payload: { call: { ...call, arguments: { q: "a" } }, tool } });
  });

  it("only lets parallel handlers deny or stop, and the first deny cancels the rest", async () => {
    const log: string[] = [];
    let slowAborted = false;
    const slow = (_: unknown, signal: AbortSignal) =>
      new Promise<HookResult>((resolve) =>
        signal.addEventListener("abort", () => {
          slowAborted = true;
          resolve({ action: "continue" });
        }),
      );
    const hooks = new HookRunner(
      [
        handler("guard", log, () => ({ action: "deny", reason: "no" })),
        handler("slow", log, slow),
        handler("later", log, ok, { stage: 1 }),
      ],
      ctx,
    );

    expect(await hooks.call("tool.before", { call, tool })).toEqual({ action: "deny", reason: "no" });
    expect(slowAborted).toBe(true);
    expect(log).toEqual(['guard {"q":"x"} deny,stop', 'slow {"q":"x"} deny,stop']);
  });

  it("treats a reply the hook doesn't allow as a failure, handled per onFailure", async () => {
    const log: string[] = [];
    const parallel = [handler("a", log, modify("a")), handler("b", log, ok)];
    expect(await new HookRunner(parallel, ctx).call("tool.before", { call, tool })).toEqual({
      action: "continue",
      payload: { call, tool },
    });

    const denying = [handler("a", log, modify("a"), { onFailure: "deny" }), handler("b", log, ok)];
    expect(await new HookRunner(denying, ctx).call("tool.before", { call, tool })).toEqual({
      action: "deny",
      reason: 'plugin "a" failed',
    });
    const stopping = [handler("a", log, modify("a"), { onFailure: "stop" }), handler("b", log, ok)];
    expect(await new HookRunner(stopping, ctx).call("tool.before", { call, tool })).toEqual({
      action: "stop",
      reason: 'plugin "a" failed',
    });
  });

  it("gives async handlers the final payload", async () => {
    const log: string[] = [];
    const seen = jest.fn<(e: HookEvent<"tool.before">) => HookResult>(ok);
    const hooks = new HookRunner(
      [handler("github", log, modify("g")), handler("log", log, seen, { async: true })],
      ctx,
    );
    await hooks.call("tool.before", { call, tool });
    await hooks.settle();

    expect(log).toEqual(['github {"q":"x"} modify,deny,respond,stop', 'log {"q":"g"} ']);
  });
});
