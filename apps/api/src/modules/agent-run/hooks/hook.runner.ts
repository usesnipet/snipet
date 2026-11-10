import { Agent } from "#src/modules/agent/agent.entity.js";
import { Logger } from "@nestjs/common";
import { AgentRunStatus, HOOK_EVENT_VERSION, HOOKS } from "@snipet/shared";
import { randomUUID } from "node:crypto";

import { AgentRun } from "../agent-run.entity.js";

import type { Owner } from "#src/common/context/app-context.js";
import type { HookContext, HookDriver } from "#src/plugin/driver.js";
import type {
  HookAction,
  HookEvent,
  HookHandler,
  HookName,
  HookOrder,
  HookPayload,
  HookRespond,
  HookResult,
  JsonObject,
} from "@snipet/shared";
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

/** Who and what a run's events are about. */
export interface HookRunnerContext {
  run: AgentRun;
  agent: Agent;
  owner: Owner;
}

/** The actions `K`'s definition accepts, so its outcome can't hold the others. */
type AcceptedAction<K extends HookName> = (typeof HOOKS)[K]["actions"][number];

/**
 * What the handlers made of a step, narrowed to the actions the hook accepts:
 * a hook without `deny` or `respond` only ever continues, so its caller needs
 * no branch. `stop` throws HookStoppedError instead.
 */
export type HookOutcome<K extends HookName> =
  | { action: "continue"; payload: HookPayload<K> }
  | ("deny" extends AcceptedAction<K> ? { action: "deny"; reason: string } : never)
  | ("respond" extends AcceptedAction<K> ? { action: "respond"; result: HookRespond<K> } : never);

/** What one handler made of a step, before the hook's accepted actions narrow it. */
type HandlerOutcome<K extends HookName> =
  | { action: "continue"; payload: HookPayload<K> }
  | { action: "deny"; reason: string }
  | { action: "respond"; result: HookRespond<K> }
  | { action: "stop"; reason: string };

/** A hook stopped the run: fails it with the hook's reason. */
export class HookStoppedError extends Error {}

/** The parts of a hook definition the runner validates replies with. */
type ParsableHookDefinition = {
  payload: { parse(value: unknown): unknown };
  respond?: { parse(value: unknown): unknown };
};

const ORDER_RANK: Record<HookOrder, number> = { first: 0, default: 1, last: 2 };

/** Whether the handler may change or answer the step, so it must run alone. */
const runsAlone = ({ handler }: BoundHandler) =>
  handler.actions.includes("modify") || handler.actions.includes("respond");

/** Splits handlers into groups: one that runs alone, or consecutive ones that run in parallel. */
function groupHandlers(handlers: BoundHandler[]): BoundHandler[][] {
  const groups: BoundHandler[][] = [];
  for (const bound of handlers) {
    const last = groups.at(-1);
    if (last && !runsAlone(bound) && !runsAlone(last[0])) last.push(bound);
    else groups.push([bound]);
  }
  return groups;
}

/** The hooks of one run. */
export class HookRunner {
  /** The run's current turn, stamped on each event. */
  turn: number = 0;
  /** The run's current status, stamped on each event. */
  status: AgentRunStatus = AgentRunStatus.RUNNING;

  /** Each plugin connection's run state, by connection id. */
  private readonly states = new Map<string, JsonObject>();
  /** Background handlers still running, awaited by settle(). */
  private readonly pending = new Set<Promise<void>>();

  /** handlers: in the agent's plugin order. */
  constructor(
    private readonly handlers: BoundHandler[],
    private readonly context: HookRunnerContext,
    private readonly logger: Logger = new Logger(HookRunner.name),
  ) {}

  /**
   * Runs the handlers of `hook` group by group, each group getting the
   * payload the last one left, until one denies, responds or stops.
   * Background handlers then get the final payload. Throws HookStoppedError on `stop`.
   *
   * A hook that accepts no action is observe-only: every handler runs in
   * background and the payload comes back untouched, so the loop never waits
   * on one. settle() waits for them.
   */
  async run<K extends HookName>(hook: K, payload: HookPayload<K>): Promise<HookOutcome<K>> {
    const handlers = this.handlersFor(hook);
    if (HOOKS[hook].actions.length === 0) {
      for (const bound of handlers) this.runInBackground(bound, payload);
      return { action: "continue", payload };
    }
    let current: HookPayload<K> = payload;
    // Set by the first handler to end the step: in a parallel group, the first to reply.
    const step: { ended?: HandlerOutcome<K> } = {};
    for (const group of groupHandlers(handlers.filter((bound) => !bound.handler.background))) {
      const groupEnded = new AbortController();
      const outcomes = await Promise.all(
        group.map(async (bound) => {
          const outcome = await this.send(bound, current, groupEnded.signal);
          if (outcome.action !== "continue" && !groupEnded.signal.aborted) {
            step.ended = outcome;
            groupEnded.abort();
          }
          return outcome;
        }),
      );
      if (step.ended) break;
      // All continued; only a lone handler can have modified the payload.
      current = (outcomes[0] as { payload: HookPayload<K> }).payload;
    }
    for (const bound of handlers) if (bound.handler.background) this.runInBackground(bound, current);
    const outcome: HandlerOutcome<K> = step.ended ?? { action: "continue", payload: current };
    if (outcome.action === "stop") throw new HookStoppedError(outcome.reason);
    // A reply outside the hook's actions never reaches here: send() turns it into a failure.
    return outcome as HookOutcome<K>;
  }

  /** Waits for the handlers still running. */
  async settle(): Promise<void> {
    await Promise.all(this.pending);
  }

  /** The handlers of `hook`, by order then plugin position (the sort is stable). */
  private handlersFor(hook: HookName): BoundHandler[] {
    return this.handlers
      .filter((bound) => bound.hook === hook)
      .sort((a, b) => ORDER_RANK[a.handler.order] - ORDER_RANK[b.handler.order]);
  }

  /** Never throws: a failed handler continues, denies or stops, per its onFailure. */
  private async send<K extends HookName>(
    bound: BoundHandler,
    payload: HookPayload<K>,
    groupSignal: AbortSignal,
  ): Promise<HandlerOutcome<K>> {
    const hook = bound.hook as K;
    const { actions, timeoutMs, onFailure } = bound.handler;
    try {
      const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), groupSignal]);
      const reply = await bound.driver.handle(
        this.buildEvent(bound, payload, actions),
        bound.options,
        this.contextOf(bound, signal),
      );
      if (reply.action !== "continue" && !actions.includes(reply.action)) throw new Error(`can't ${reply.action}`);
      const outcome = this.toOutcome(hook, payload, reply);
      if (reply.state) this.states.set(bound.plugin.id, { ...this.stateOf(bound), ...reply.state });
      return outcome;
    } catch (err) {
      // Another handler of the group ended the step.
      if (groupSignal.aborted) return { action: "continue", payload };
      this.warnFailure(bound, err);
      if (onFailure === "continue") return { action: "continue", payload };
      return { action: onFailure, reason: `plugin "${bound.plugin.name}" failed` };
    }
  }

  /** The reply as an outcome, checked against the hook's schemas. Throws when it doesn't fit. */
  private toOutcome<K extends HookName>(hook: K, payload: HookPayload<K>, reply: HookResult): HandlerOutcome<K> {
    const definition: ParsableHookDefinition = HOOKS[hook];
    switch (reply.action) {
      case "deny":
      case "stop":
        return { action: reply.action, reason: reply.reason };
      case "respond":
        return { action: "respond", result: definition.respond!.parse(reply.result) as HookRespond<K> };
      case "modify":
        return {
          action: "continue",
          payload: definition.payload.parse({ ...payload, ...reply.payload }) as HookPayload<K>,
        };
      case "continue":
        return { action: "continue", payload };
    }
  }

  /** Runs the handler without waiting; its reply is ignored and a failure only logged. */
  private runInBackground(bound: BoundHandler, payload: unknown): void {
    const signal = AbortSignal.timeout(bound.handler.timeoutMs);
    const running: Promise<void> = bound.driver
      .handle(this.buildEvent(bound, payload, []), bound.options, this.contextOf(bound, signal))
      .then(
        () => undefined,
        (err: unknown) => this.warnFailure(bound, err),
      )
      .finally(() => this.pending.delete(running));
    this.pending.add(running);
  }

  private warnFailure(bound: BoundHandler, err: unknown): void {
    this.logger.warn(`hook ${bound.hook} (${bound.plugin.name}) on run ${this.context.run.id}: ${String(err)}`);
  }

  private stateOf(bound: BoundHandler): JsonObject {
    return this.states.get(bound.plugin.id) ?? {};
  }

  /** What a handler gets besides the event; copies, so a driver can't change them. */
  private contextOf(bound: BoundHandler, signal: AbortSignal): HookContext {
    return { settings: structuredClone(bound.settings), state: structuredClone(this.stateOf(bound)), signal };
  }

  private buildEvent(bound: BoundHandler, payload: unknown, actions: readonly HookAction[]): HookEvent {
    const { run, agent, owner } = this.context;
    return {
      version: HOOK_EVENT_VERSION,
      id: randomUUID(),
      hook: bound.hook,
      actions: [...actions],
      occurredAt: new Date().toISOString(),
      run: { id: run.id, sessionId: run.sessionId, turn: this.turn, status: this.status },
      agent: { id: agent.id, name: agent.name },
      user: owner,
      settings: structuredClone(bound.settings),
      state: structuredClone(this.stateOf(bound)),
      // Snapshot: the loop keeps mutating its history after this returns.
      payload: structuredClone(payload),
    } as HookEvent;
  }
}
