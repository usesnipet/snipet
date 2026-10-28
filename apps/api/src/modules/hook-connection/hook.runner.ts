import { isGranted } from "#src/utils/grant/grant.js";
import { Logger } from "@nestjs/common";
import { AgentRunStatus, HOOK_EVENT_VERSION, HOOKS } from "@snipet/shared";
import { randomUUID } from "node:crypto";

import type { Owner } from "#src/common/decorators/owner.decorator.js";
import type { HookDriver } from "#src/hook/driver.js";
import type {
  Agent,
  AgentRun,
  HookAction,
  HookEvent,
  HookMatch,
  HookMatchKey,
  HookName,
  HookOnError,
  HookPayload,
  HookRespond,
  HookResult,
  JsonObject,
  LlmToolCallPart,
} from "@snipet/shared";

/** A bound hook ready to run: its driver with the connection's options resolved. */
export interface HookHandler {
  name: string;
  event: HookName;
  /** Global hooks run before the agent's; stages never mix the two. */
  global: boolean;
  stage: number;
  match: HookMatch | null;
  async: boolean;
  onError: HookOnError;
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
  | { action: "block"; reason: string }
  | { action: "respond"; result: HookRespond<K> };

/** A step a hook blocked: fails the run with the hook's reason. */
export class HookBlockedError extends Error {}

/** The payload fields the `match` filters read; which exist depends on the hook. */
type MatchablePayload = {
  call?: LlmToolCallPart;
  model?: string | null;
  targets?: { model: string }[];
};

/** The parts of a hook definition the runner validates replies with. */
type ParsableHookDefinition = {
  payload: { parse(value: unknown): unknown };
  respond?: { parse(value: unknown): unknown };
};

/** Whether the payload passes the filters its hook point applies. */
function matchesFilters(hook: HookName, match: HookMatch | null, payload: unknown): boolean {
  if (!match) return true;
  const { call, model, targets } = payload as MatchablePayload;
  const candidatesByKey: Record<HookMatchKey, string[]> = {
    tools: call ? [call.name] : [],
    models: targets?.map((target) => target.model) ?? (model ? [model] : []),
  };
  const appliedKeys: readonly HookMatchKey[] = HOOKS[hook].match;
  return appliedKeys.every((key) => {
    const allow = match[key];
    return !allow?.length || candidatesByKey[key].some((candidate) => isGranted(candidate, { allow }));
  });
}

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

  /** Shared by the run's handlers: each reply's metadata is merged in. */
  private readonly metadata: JsonObject = {};
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
    for (const handler of this.handlersFor(hook, payload)) this.runInBackground(handler, hook, payload);
  }

  /**
   * Runs the synchronous handlers of `hook` stage by stage, each stage getting
   * the payload the last one left, until one blocks or responds. Async
   * handlers then get the final payload.
   */
  async call<K extends HookName>(hook: K, payload: HookPayload<K>): Promise<HookOutcome<K>> {
    const handlers = this.handlersFor(hook, payload);
    let currentPayload: HookPayload<K> = payload;
    let outcome: HookOutcome<K> | undefined;
    for (const stage of groupIntoStages(handlers.filter((handler) => !handler.async))) {
      // Parallel handlers all get the same payload, so only a lone one may change or answer it.
      const allowedActions: readonly HookAction[] = stage.length > 1 ? ["block"] : HOOKS[hook].actions;
      const stageBlocked = new AbortController();
      const outcomes = await Promise.all(
        stage.map(async (handler) => {
          const handlerOutcome = await this.send(handler, hook, currentPayload, allowedActions, stageBlocked.signal);
          if (handlerOutcome.action === "block") stageBlocked.abort();
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
    throw new HookBlockedError(outcome.action === "block" ? outcome.reason : `${hook} can't be answered`);
  }

  /** Waits for the handlers still running. */
  async settle(): Promise<void> {
    await Promise.all(this.pending);
  }

  /** The handlers bound to `hook` whose match filters let the payload through. */
  private handlersFor(hook: HookName, payload: unknown): HookHandler[] {
    return this.handlers.filter((handler) => handler.event === hook && matchesFilters(hook, handler.match, payload));
  }

  /** Never throws: a failed handler continues, or blocks when its onError is `fail`. */
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
      const reply: HookResult = await handler.driver.handle(event, handler.options, signal);
      if (reply.action !== "continue" && !allowedActions.includes(reply.action)) {
        throw new Error(`can't ${reply.action} here`);
      }
      const outcome = this.toOutcome(hook, payload, reply) ?? unchanged;
      if (reply.metadata) Object.assign(this.metadata, reply.metadata);
      return outcome;
    } catch (err) {
      // Another handler of the stage blocked: this one's reply no longer matters.
      if (stageSignal.aborted) return unchanged;
      this.warnFailure(handler, hook, err);
      return handler.onError === "fail" ? { action: "block", reason: `hook "${handler.name}" failed` } : unchanged;
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
      case "block":
        return { action: "block", reason: reply.reason };
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
      .handle(event, handler.options, AbortSignal.timeout(handler.timeoutMs))
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

  private buildEvent(hook: HookName, payload: unknown, allowedActions: readonly HookAction[]): HookEvent {
    const { run, agent, owner } = this.context;
    return {
      version: HOOK_EVENT_VERSION,
      id: randomUUID(),
      hook,
      actions: [...allowedActions],
      occurredAt: new Date().toISOString(),
      run: { ...run, turn: this.turn, status: this.status },
      agent,
      owner,
      metadata: { ...this.metadata },
      // Snapshot: the loop keeps mutating its history after this returns.
      payload: structuredClone(payload),
    } as HookEvent;
  }
}
