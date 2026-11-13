import { AgentRunStatus } from "@snipet/shared";
import {
  hookHandlerSchema,
  HookAction,
  HookMode,
  HookName,
  HookOnFailure,
  LLMMessagePartType,
} from "@snipet/shared/core";

import { HookRunner, HookStoppedError } from "./hook.runner.js";

import type { HookContext, HookDriver } from "../driver.js";
import type { BoundHandler } from "./hook.runner.js";
import type { HookEvent, HookResult } from "@snipet/shared/core";

const logger = { log() {}, warn() {}, error() {} };
const context = {
  run: { id: "r1", sessionId: "s1" },
  agent: { id: "ag1", name: "Bot" },
  owner: { userId: "u1", appId: null, externalUserId: null, name: "Ana" },
};
const call = { type: LLMMessagePartType.TOOL_CALL as const, id: "c1", name: "search", arguments: { q: "x" } };
const source = { id: "p1", name: "GitHub" };
const result = { content: "ok", isError: false };

type Reply = (event: HookEvent, context: HookContext) => unknown;

/** A handler of plugin `name` on `hook` that logs the plugin name and answers with `reply`. */
function handler(
  name: string,
  log: string[],
  reply: Reply,
  options: Record<string, unknown> = {},
  hook: HookName = HookName.TOOL_BEFORE,
): BoundHandler {
  const driver = {
    handle: (event: HookEvent, _: unknown, ctx: HookContext) => {
      log.push(name);
      return Promise.resolve().then(() => reply(event, ctx));
    },
  } as unknown as HookDriver;
  return {
    plugin: { id: name, name },
    hook,
    handler: hookHandlerSchema.parse(options),
    driver,
    options: {},
    settings: { who: name },
  };
}

const ok = (): HookResult => ({ action: HookAction.CONTINUE });
/** Appends `q` to the call's q argument. */
const appendQ =
  (q: string): Reply =>
  (event) => {
    const asked = (event.payload as { call: typeof call }).call;
    const previous = asked.arguments.q;
    return { action: HookAction.MODIFY, payload: { call: { ...asked, arguments: { q: `${previous}${q}` } } } };
  };

describe("HookRunner.run", () => {
  it("runs going-in hooks in plugin order, chaining the payload through modifies", async () => {
    const log: string[] = [];
    const hooks = new HookRunner([handler("a", log, appendQ("a")), handler("b", log, appendQ("b"))], context, logger);
    const outcome = await hooks.run(HookName.TOOL_BEFORE, { call, tool: source });
    expect(log).toEqual(["a", "b"]);
    expect(outcome).toEqual({
      action: HookAction.CONTINUE,
      payload: { call: { ...call, arguments: { q: "xab" } }, tool: source },
    });
  });

  it("runs coming-out hooks in reverse plugin order", async () => {
    const log: string[] = [];
    const after = (name: string) => handler(name, log, ok, {}, HookName.TOOL_AFTER);
    const hooks = new HookRunner([after("a"), after("b")], context, logger);
    await hooks.run(HookName.TOOL_AFTER, { call, result, durationMs: 1, error: null });
    expect(log).toEqual(["b", "a"]);
  });

  it("ends the step on deny or respond, and throws on stop", async () => {
    const log: string[] = [];
    const deny = handler("guard", log, () => ({ action: HookAction.DENY, reason: "no" }));
    const later = handler("later", log, ok);
    await expect(
      new HookRunner([deny, later], context, logger).run(HookName.TOOL_BEFORE, { call, tool: source }),
    ).resolves.toEqual({
      action: HookAction.DENY,
      reason: "no",
    });
    expect(log).toEqual(["guard"]);

    const respond = handler("cache", log, () => ({ action: HookAction.RESPOND, result }));
    await expect(
      new HookRunner([respond], context, logger).run(HookName.TOOL_BEFORE, { call, tool: source }),
    ).resolves.toEqual({
      action: HookAction.RESPOND,
      result,
    });

    const stop = handler("kill", log, () => ({ action: HookAction.STOP, reason: "budget" }));
    await expect(
      new HookRunner([stop], context, logger).run(HookName.TOOL_BEFORE, { call, tool: source }),
    ).rejects.toThrow(new HookStoppedError("budget"));
  });

  it("treats a reply the hook doesn't accept, or a read-only change, as a failure", async () => {
    const log: string[] = [];
    // tool.after accepts no deny; tool.before lets only `call` change.
    const deny = handler("a", log, () => ({ action: HookAction.DENY, reason: "no" }), {}, HookName.TOOL_AFTER);
    const outcome = await new HookRunner([deny], context, logger).run(HookName.TOOL_AFTER, {
      call,
      result,
      durationMs: 1,
      error: null,
    });
    expect(outcome.action).toBe(HookAction.CONTINUE);

    const readOnly = handler("b", log, () => ({ action: HookAction.MODIFY, payload: { tool: null } }));
    await expect(
      new HookRunner([readOnly], context, logger).run(HookName.TOOL_BEFORE, { call, tool: source }),
    ).resolves.toEqual({ action: HookAction.CONTINUE, payload: { call, tool: source } });
  });

  it("applies onFailure when a handler throws or times out", async () => {
    const log: string[] = [];
    const fail = (onFailure: HookOnFailure) =>
      handler("f", log, () => Promise.reject(new Error("down")), { onFailure });
    const run = (bound: BoundHandler) =>
      new HookRunner([bound], context, logger).run(HookName.TOOL_BEFORE, { call, tool: source });

    await expect(run(fail(HookOnFailure.CONTINUE))).resolves.toEqual({
      action: HookAction.CONTINUE,
      payload: { call, tool: source },
    });
    await expect(run(fail(HookOnFailure.DENY))).resolves.toEqual({
      action: HookAction.DENY,
      reason: 'plugin "f" failed',
    });
    await expect(run(fail(HookOnFailure.STOP))).rejects.toThrow('plugin "f" failed');

    const hang = handler("slow", log, () => new Promise(() => {}), { timeoutMs: 5, onFailure: HookOnFailure.DENY });
    await expect(run(hang)).resolves.toEqual({ action: HookAction.DENY, reason: 'plugin "slow" failed' });
  });

  it("doesn't wait for background handlers, which get the payload at their place in the onion", async () => {
    const log: string[] = [];
    let release!: () => void;
    const seen: unknown[] = [];
    const watcher = handler(
      "watch",
      log,
      async (event) => {
        seen.push(event.payload);
        await new Promise<void>((resolve) => (release = resolve));
        return { action: HookAction.STOP, reason: "ignored" };
      },
      { mode: HookMode.BACKGROUND },
    );
    const hooks = new HookRunner(
      [handler("a", log, appendQ("a")), watcher, handler("b", log, appendQ("b"))],
      context,
      logger,
    );

    const outcome = await hooks.run(HookName.TOOL_BEFORE, { call, tool: source });
    expect(outcome).toEqual({
      action: HookAction.CONTINUE,
      payload: { call: { ...call, arguments: { q: "xab" } }, tool: source },
    });
    expect(seen).toEqual([{ call: { ...call, arguments: { q: "xa" } }, tool: source }]);

    let settled = false;
    const settling = hooks.settle().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await settling;
    expect(settled).toBe(true);
  });

  it("stamps the envelope and keeps each plugin's state to itself", async () => {
    const events: HookEvent[] = [];
    const remember = handler("a", [], (event) => {
      events.push(event);
      return { action: HookAction.CONTINUE, state: { count: ((event.state.count as number) ?? 0) + 1 } };
    });
    const other = handler("b", [], (event) => {
      events.push(event);
      return ok();
    });
    const hooks = new HookRunner([remember, other], context, logger);
    hooks.turn = 2;
    hooks.status = AgentRunStatus.RUNNING;
    await hooks.run(HookName.TOOL_BEFORE, { call, tool: source });
    await hooks.run(HookName.TOOL_BEFORE, { call, tool: source });

    expect(events[0]).toMatchObject({
      hook: HookName.TOOL_BEFORE,
      run: { id: "r1", sessionId: "s1", turn: 2, status: AgentRunStatus.RUNNING },
      agent: { id: "ag1", name: "Bot" },
      owner: context.owner,
      settings: { who: "a" },
      state: {},
    });
    expect(events.map((event) => event.state)).toEqual([{}, {}, { count: 1 }, {}]);
  });
});
