import { AgentRunStatus } from "@snipet/shared";
import { HookAction, HookMode, HookOnFailure, HOOKS, inHookOrder } from "@snipet/shared/core";
import { randomUUID } from "node:crypto";

import type { JsonObject } from "@snipet/shared";
import type { HookEvent, HookHandler, HookName, HookPayload, HookResult } from "@snipet/shared/core";
import type { Owner } from "../../context.js";
import type { Logger } from "../../logger.js";
import type { HookContext, HookDriver } from "../driver.js";

/** A plugin's handler on one hook, ready to run: its driver with the connection's options resolved. */
export interface BoundHandler {
  /** The plugin connection: its name goes in failure reasons, its id keys the run state. */
  plugin: { id: string; name: string };
  hook: HookName;
  handler: HookHandler;
  driver: HookDriver;
  options: unknown;
  /** The agent's settings for the plugin. */
  settings: JsonObject;
}

/** Who a run's events are about; runId only names the run in logs. */
export interface HookRunnerContext {
  runId: string;
  owner: Owner;
}

/**
 * What the handlers made of a step: the payload to go on with, or the reply
 * that ended it. `stop` throws HookStoppedError instead.
 */
export type HookOutcome<K extends HookName> =
  | { action: HookAction.CONTINUE; payload: HookPayload<K> }
  | Extract<HookResult<K>, { action: HookAction.DENY | HookAction.RESPOND }>;

/** A hook stopped the run: fails it with the hook's reason. */
export class HookStoppedError extends Error {}

/** A reply once checked against its hook's schema, whatever the hook. */
type Reply = {
  action: HookAction;
  reason?: string;
  result?: unknown;
  payload?: Record<string, unknown>;
  state?: JsonObject;
};

/** What one handler made of a step. */
type Step = { action: HookAction.CONTINUE; payload: unknown } | Reply;

/** Rejects when `signal` aborts, so a driver that ignores its signal still times out. */
const abortOf = (signal: AbortSignal) =>
  new Promise<never>((_, reject) =>
    signal.addEventListener("abort", () => reject(new Error("hook timed out", { cause: signal.reason })), {
      once: true,
    }),
  );

/**
 * The hooks of one run. Handlers run like an onion: in plugin order going in,
 * reversed coming out (see HookPhase).
 */
export class HookRunner {
  /** The run's current turn, stamped on each event. */
  turn = 0;
  /** The run's current status, stamped on each event. */
  status = AgentRunStatus.RUNNING;

  /** Each plugin connection's run state, by connection id. */
  private readonly states = new Map<string, JsonObject>();
  /** Background handlers still running, awaited by settle(). */
  private readonly pending = new Set<Promise<void>>();

  /** handlers: in the agent's plugin order. */
  constructor(
    private readonly handlers: BoundHandler[],
    private readonly context: HookRunnerContext,
    private readonly logger: Logger,
  ) {}

  /**
   * Runs the handlers of `hook` in onion order. A sequential one gets the
   * payload the previous left and may end the step; a background one gets a
   * snapshot of it and isn't waited for. Throws HookStoppedError on `stop`.
   */
  async run<K extends HookName>(hook: K, payload: HookPayload<K>): Promise<HookOutcome<K>> {
    let current: unknown = payload;
    const handlers = inHookOrder(
      hook,
      this.handlers.filter((bound) => bound.hook === hook),
    );
    for (const bound of handlers) {
      if (bound.handler.mode === HookMode.BACKGROUND) {
        this.runInBackground(bound, current);
        continue;
      }
      const step = await this.send(bound, current);
      if (step.action === HookAction.STOP) throw new HookStoppedError(step.reason);
      if (step.action !== HookAction.CONTINUE) return step as HookOutcome<K>;
      current = step.payload;
    }
    return { action: HookAction.CONTINUE, payload: current as HookPayload<K> };
  }

  /** Waits for the background handlers still running. */
  async settle(): Promise<void> {
    await Promise.all(this.pending);
  }

  /** Never throws: a failed handler continues, denies or stops, per its onFailure. */
  private async send(bound: BoundHandler, payload: unknown): Promise<Step> {
    const definition = HOOKS[bound.hook];
    try {
      const reply = definition.result.parse(await this.handle(bound, payload)) as Reply;
      let step: Step = reply;
      if (reply.action === HookAction.CONTINUE) step = { action: HookAction.CONTINUE, payload };
      if (reply.action === HookAction.MODIFY) {
        // Shallow merge; the reply schema already refused keys the hook doesn't let change.
        step = {
          action: HookAction.CONTINUE,
          payload: definition.payload.parse({ ...(payload as object), ...reply.payload }),
        };
      }
      if (reply.state) this.states.set(bound.plugin.id, { ...this.stateOf(bound), ...reply.state });
      return step;
    } catch (err) {
      this.warnFailure(bound, err);
      const reason = `plugin "${bound.plugin.name}" failed`;
      switch (bound.handler.onFailure) {
        case HookOnFailure.CONTINUE:
          return { action: HookAction.CONTINUE, payload };
        case HookOnFailure.DENY:
          return { action: HookAction.DENY, reason };
        case HookOnFailure.STOP:
          return { action: HookAction.STOP, reason };
      }
    }
  }

  /** Runs the handler without waiting; its reply is ignored and a failure only logged. */
  private runInBackground(bound: BoundHandler, payload: unknown): void {
    const running: Promise<void> = this.handle(bound, payload)
      .then(
        () => undefined,
        (err: unknown) => this.warnFailure(bound, err),
      )
      .finally(() => this.pending.delete(running));
    this.pending.add(running);
  }

  /** The driver's raw reply, or a rejection on failure or timeout. */
  private handle(bound: BoundHandler, payload: unknown): Promise<unknown> {
    const signal = AbortSignal.timeout(bound.handler.timeoutMs);
    // Copies, so a driver can't change what the next handler or the loop sees.
    const settings = structuredClone(bound.settings);
    const state = structuredClone(this.stateOf(bound));
    const event = {
      id: randomUUID(),
      hook: bound.hook,
      payload: structuredClone(payload),
      occurredAt: new Date().toISOString(),
      run: { turn: this.turn, status: this.status },
      owner: this.context.owner,
      settings,
      state,
    } as HookEvent;
    const context: HookContext = { settings, state, signal };
    return Promise.race([bound.driver.handle(event, bound.options, context), abortOf(signal)]);
  }

  private warnFailure(bound: BoundHandler, err: unknown): void {
    this.logger.warn(`hook ${bound.hook} (${bound.plugin.name}) on run ${this.context.runId}: ${String(err)}`);
  }

  private stateOf(bound: BoundHandler): JsonObject {
    return this.states.get(bound.plugin.id) ?? {};
  }
}
