import { jest } from "@jest/globals";

import { HookRunner } from "./hook.runner.js";

import type { HookDriver } from "#src/hook/driver.js";
import type { HookHandler, HookRunnerContext } from "./hook.runner.js";
import type { HookEvent, HookResult } from "@snipet/shared";

const ctx = { run: { id: "r1" }, agent: { id: "ag1" }, owner: {} } as unknown as HookRunnerContext;
const call = { type: "tool_call" as const, id: "c1", name: "github_search", arguments: { q: "x" } };

/** A tool.before handler that logs what it got and answers with reply. */
function handler(
  name: string,
  log: string[],
  reply: (e: HookEvent<"tool.before">, signal: AbortSignal) => Promise<HookResult> | HookResult,
  rest: Partial<HookHandler> = {},
): HookHandler {
  const driver = {
    handle: async (e: HookEvent<"tool.before">, _: unknown, signal: AbortSignal) => {
      log.push(`${name} ${JSON.stringify(e.payload.call.arguments)} ${e.actions.join(",")}`);
      return reply(e, signal);
    },
  } as unknown as HookDriver;
  return {
    name,
    event: "tool.before",
    global: false,
    stage: 0,
    match: null,
    async: false,
    onError: "continue",
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
    const outcome = await hooks.call("tool.before", { call });

    expect(log).toEqual([
      'global {"q":"x"} modify,block,respond',
      'a {"q":"g"} modify,block,respond',
      'b {"q":"a"} modify,block,respond',
    ]);
    expect(outcome).toEqual({ action: "continue", payload: { call: { ...call, arguments: { q: "a" } } } });
  });

  it("only lets parallel handlers block, and the first block cancels the rest", async () => {
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
        handler("guard", log, () => ({ action: "block", reason: "no" })),
        handler("slow", log, slow),
        handler("later", log, ok, { stage: 1 }),
      ],
      ctx,
    );

    expect(await hooks.call("tool.before", { call })).toEqual({ action: "block", reason: "no" });
    expect(slowAborted).toBe(true);
    expect(log).toEqual(['guard {"q":"x"} block', 'slow {"q":"x"} block']);
  });

  it("treats a reply the hook doesn't allow as an error, which blocks only on onError fail", async () => {
    const log: string[] = [];
    const parallel = [handler("a", log, modify("a")), handler("b", log, ok)];
    expect(await new HookRunner(parallel, ctx).call("tool.before", { call })).toEqual({
      action: "continue",
      payload: { call },
    });

    const failing = [handler("a", log, modify("a"), { onError: "fail" }), handler("b", log, ok)];
    expect(await new HookRunner(failing, ctx).call("tool.before", { call })).toEqual({
      action: "block",
      reason: 'hook "a" failed',
    });
  });

  it("skips handlers whose match filters leave the call out, and gives async ones the final payload", async () => {
    const log: string[] = [];
    const seen = jest.fn<(e: HookEvent<"tool.before">) => HookResult>(ok);
    const hooks = new HookRunner(
      [
        handler("jira", log, modify("j"), { match: { tools: ["jira_*"] } }),
        handler("github", log, modify("g"), { match: { tools: ["github_*"] } }),
        handler("log", log, seen, { async: true }),
      ],
      ctx,
    );
    await hooks.call("tool.before", { call });
    await hooks.settle();

    expect(log).toEqual(['github {"q":"x"} modify,block,respond', 'log {"q":"g"} ']);
  });
});
