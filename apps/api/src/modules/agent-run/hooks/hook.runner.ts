import { Logger } from "@nestjs/common";
import { AgentRunStatus, HOOK_EVENT_VERSION, HOOKS } from "@snipet/shared";
import { randomUUID } from "node:crypto";

import type { Owner } from "#src/common/decorators/owner.decorator.js";
import type { HookContext, HookDriver } from "#src/plugin/driver.js";
import type {
  Agent,
  AgentRun,
  HookAction,
  HookEvent,
  HookName,
  HookOnFailure,
  HookPayload,
  HookRespond,
  HookResult,
  JsonObject,
} from "@snipet/shared";

/** A bound hook ready to run: its driver with the connection's options resolved. */
export interface HookHandler {
  name: string;
  event: HookName;
  /** Global hooks run before the agent's; stages never mix the two. */
  global: boolean;
  stage: number;
  async: boolean;
  onFailure: HookOnFailure;
  driver: HookDriver;
  options: unknown;
  timeoutMs: number;
}

/** Who and what a run's events are about. */
export interface HookRunnerContext {
  run: AgentRun;
  agent: Agent;
  owner: Owner;
}

/** What the handlers made of a step. */
export type HookOutcome<K extends HookName> =
  | { action: "continue"; payload: HookPayload<K> }
  | { action: "deny"; reason: string }
  | { action: "stop"; reason: string }
  | { action: "respond"; result: HookRespond<K> };

/** A step a hook stopped or denied where it can't be: fails the run with the hook's reason. */
export class HookBlockedError extends Error {}

/** The parts of a hook definition the runner validates replies with. */
type ParsableHookDefinition = {
  payload: { parse(value: unknown): unknown };
  respond?: { parse(value: unknown): unknown };
};

/** Splits handlers into stages: consecutive ones of the same group and stage, which run in parallel. */
function groupIntoStages(handlers: HookHandler[]): HookHandler[][] {
  const stages: HookHandler[][] = [];
  for (const handler of handlers) {
    const lastStage = stages.at(-1);
    const sameStage = lastStage && lastStage[0].global === handler.global && lastStage[0].stage === handler.stage;
    if (sameStage) lastStage.push(handler);
    else stages.push([handler]);
  }
  return stages;
}

/** The hooks of one run. */
export class HookRunner {
  /** The run's current turn, stamped on each event. */
  turn: number = 0;
  /** The run's current status, stamped on each event. */
  status: AgentRunStatus = AgentRunStatus.RUNNING;

  /** Shared by the run's handlers: each reply's state is merged in. */
  // TODO(phase 5): one state per plugin connection.
  private readonly state: JsonObject = {};
  /** Async handlers still running, awaited by settle(). */
  private readonly pending = new Set<Promise<void>>();

  /** handlers: globals first, then the agent's, each group by stage. */
  constructor(
    private readonly handlers: HookHandler[],
    private readonly context: HookRunnerContext,
    private readonly logger: Logger = new Logger(HookRunner.name),
  ) {}

  /** Fires `hook` on every handler bound to it without waiting; replies are ignored. */
  emit<K extends HookName>(hook: K, payload: HookPayload<K>): void {
    for (const handler of this.handlersFor(hook)) this.runInBackground(handler, hook, payload);
  }

  /**
   * Runs the synchronous handlers of `hook` stage by stage, each stage getting
   * the payload the last one left, until one blocks or responds. Async
   * handlers then get the final payload.
   */
  async call<K extends HookName>(hook: K, payload: HookPayload<K>): Promise<HookOutcome<K>> {
    const handlers = this.handlersFor(hook);
    let currentPayload: HookPayload<K> = payload;
    let outcome: HookOutcome<K> | undefined;
    for (const stage of groupIntoStages(handlers.filter((handler) => !handler.async))) {
      // Parallel handlers all get the same payload, so only a lone one may change or answer it.
      const accepted: readonly HookAction[] = HOOKS[hook].actions;
      const allowedActions = stage.length > 1 ? accepted.filter((a) => a === "deny" || a === "stop") : accepted;
      const stageBlocked = new AbortController();
      const outcomes = await Promise.all(
        stage.map(async (handler) => {
          const handlerOutcome = await this.send(handler, hook, currentPayload, allowedActions, stageBlocked.signal);
          if (handlerOutcome.action === "deny" || handlerOutcome.action === "stop") stageBlocked.abort();
          return handlerOutcome;
        }),
      );
      outcome = outcomes.find((candidate) => candidate.action !== "continue");
      if (outcome) break;
      // Every outcome is `continue` here, and only a lone handler can have modified the payload.
      currentPayload = (outcomes[0] as { payload: HookPayload<K> }).payload;
    }
    for (const handler of handlers) if (handler.async) this.runInBackground(handler, hook, currentPayload);
    return outcome ?? { action: "continue", payload: currentPayload };
  }

  /** call() for a step that can't be answered: the final payload, or HookBlockedError. */
  async pass<K extends HookName>(hook: K, payload: HookPayload<K>): Promise<HookPayload<K>> {
    const outcome = await this.call(hook, payload);
    if (outcome.action === "continue") return outcome.payload;
    throw new HookBlockedError(outcome.action === "respond" ? `${hook} can't be answered` : outcome.reason);
  }

  /** Waits for the handlers still running. */
  async settle(): Promise<void> {
    await Promise.all(this.pending);
  }

  private handlersFor(hook: HookName): HookHandler[] {
    return this.handlers.filter((handler) => handler.event === hook);
  }

  /** Never throws: a failed handler continues, denies or stops, per its onFailure. */
  private async send<K extends HookName>(
    handler: HookHandler,
    hook: K,
    payload: HookPayload<K>,
    allowedActions: readonly HookAction[],
    stageSignal: AbortSignal,
  ): Promise<HookOutcome<K>> {
    const unchanged: HookOutcome<K> = { action: "continue", payload };
    try {
      const signal = AbortSignal.any([AbortSignal.timeout(handler.timeoutMs), stageSignal]);
      const event = this.buildEvent(hook, payload, allowedActions);
      const reply: HookResult = await handler.driver.handle(event, handler.options, this.contextOf(signal));
      if (reply.action !== "continue" && !allowedActions.includes(reply.action)) {
        throw new Error(`can't ${reply.action} here`);
      }
      const outcome = this.toOutcome(hook, payload, reply) ?? unchanged;
      if (reply.state) Object.assign(this.state, reply.state);
      return outcome;
    } catch (err) {
      // Another handler of the stage ended it: this one's reply no longer matters.
      if (stageSignal.aborted) return unchanged;
      this.warnFailure(handler, hook, err);
      if (handler.onFailure === "continue") return unchanged;
      return { action: handler.onFailure, reason: `plugin "${handler.name}" failed` };
    }
  }

  /** The reply as an outcome, checked against the hook's schemas; undefined for `continue`. Throws when it doesn't fit. */
  private toOutcome<K extends HookName>(
    hook: K,
    payload: HookPayload<K>,
    reply: HookResult,
  ): HookOutcome<K> | undefined {
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
        return undefined;
    }
  }

  /** Runs the handler without waiting; its reply is ignored and a failure only logged. */
  private runInBackground(handler: HookHandler, hook: HookName, payload: unknown): void {
    const event = this.buildEvent(hook, payload, []);
    const running: Promise<void> = handler.driver
      .handle(event, handler.options, this.contextOf(AbortSignal.timeout(handler.timeoutMs)))
      .then(
        () => undefined,
        (err: unknown) => this.warnFailure(handler, hook, err),
      )
      .finally(() => this.pending.delete(running));
    this.pending.add(running);
  }

  private warnFailure(handler: HookHandler, hook: HookName, err: unknown): void {
    this.logger.warn(`hook ${hook} (${handler.name}) on run ${this.context.run.id}: ${String(err)}`);
  }

  /** What a handler gets besides the event. */
  private contextOf(signal: AbortSignal): HookContext {
    // TODO(phase 5): the agent's settings for the plugin.
    return { settings: {}, state: { ...this.state }, signal };
  }

  private buildEvent(hook: HookName, payload: unknown, allowedActions: readonly HookAction[]): HookEvent {
    const { run, agent, owner } = this.context;
    return {
      version: HOOK_EVENT_VERSION,
      id: randomUUID(),
      hook,
      actions: [...allowedActions],
      occurredAt: new Date().toISOString(),
      run: { id: run.id, sessionId: run.sessionId, turn: this.turn, status: this.status },
      agent: { id: agent.id, name: agent.name },
      user: owner,
      settings: {},
      state: { ...this.state },
      // Snapshot: the loop keeps mutating its history after this returns.
      payload: structuredClone(payload),
    } as HookEvent;
  }
}
