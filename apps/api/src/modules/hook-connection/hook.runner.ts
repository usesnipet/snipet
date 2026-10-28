import { isGranted } from "#src/utils/grant/grant.js";
import { Logger } from "@nestjs/common";
import { AgentRunStatus, HOOKS } from "@snipet/shared";
import { randomUUID } from "node:crypto";

import type { Owner } from "#src/common/decorators/owner.decorator.js";
import type { HookDriver } from "#src/hook/driver.js";
import type {
  Agent,
  AgentRun,
  HookAction,
  HookEvent,
  HookMatch,
  HookName,
  HookPayload,
  HookRespond,
  JsonObject,
} from "@snipet/shared";

/** Timeout of a synchronous handler without its own: it holds the run up. */
export const SYNC_TIMEOUT_MS = 5_000;
/** Timeout of an async handler without its own. */
export const ASYNC_TIMEOUT_MS = 30_000;

/** A bound hook ready to run: its driver with the connection's options resolved. */
export interface HookHandler {
  name: string;
  event: HookName;
  /** Global hooks run before the agent's; stages never mix the two. */
  global: boolean;
  stage: number;
  match: HookMatch | null;
  async: boolean;
  onError: "continue" | "fail";
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

/** Whether the payload passes the filters its hook point applies. */
function matches(hook: HookName, match: HookMatch | null, payload: unknown): boolean {
  if (!match) return true;
  const p = payload as { call?: { name: string }; model?: string | null; targets?: { model: string }[] };
  const values: Record<keyof HookMatch, string[]> = {
    tools: p.call ? [p.call.name] : [],
    models: p.targets?.map((t) => t.model) ?? (p.model ? [p.model] : []),
  };
  return (HOOKS[hook].match as readonly (keyof HookMatch)[]).every((key) => {
    const allow = match[key];
    return !allow?.length || values[key].some((v) => isGranted(v, { allow }));
  });
}

/** Consecutive handlers of the same group and stage: they run in parallel. */
function stages(handlers: HookHandler[]): HookHandler[][] {
  const out: HookHandler[][] = [];
  for (const h of handlers) {
    const last = out.at(-1);
    if (last && last[0].global === h.global && last[0].stage === h.stage) last.push(h);
    else out.push([h]);
  }
  return out;
}

/** The hooks of one run. */
export class HookRunner {
  /** The run's current turn and status, stamped on each event. */
  turn = 0;
  status = AgentRunStatus.RUNNING;

  private readonly metadata: JsonObject = {};
  private readonly pending = new Set<Promise<void>>();

  /** handlers: globals first, then the agent's, each group by stage. */
  constructor(
    private readonly handlers: HookHandler[],
    private readonly ctx: HookRunnerContext,
    private readonly logger = new Logger(HookRunner.name),
  ) {}

  /** Fires `hook` on every handler bound to it without waiting; replies are ignored. */
  emit<K extends HookName>(hook: K, payload: HookPayload<K>): void {
    for (const h of this.bound(hook, payload)) this.background(h, hook, payload);
  }

  /**
   * Runs the synchronous handlers of `hook` stage by stage, each stage getting
   * the payload the last one left, until one blocks or responds. Async
   * handlers then get the final payload.
   */
  async call<K extends HookName>(hook: K, payload: HookPayload<K>): Promise<HookOutcome<K>> {
    const handlers = this.bound(hook, payload);
    let current = payload;
    let outcome: HookOutcome<K> | undefined;
    for (const stage of stages(handlers.filter((h) => !h.async))) {
      // Parallel handlers all get the same payload, so only a lone one may change or answer it.
      const actions = stage.length > 1 ? (["block"] as const) : HOOKS[hook].actions;
      const blocked = new AbortController();
      const replies = await Promise.all(
        stage.map(async (h) => {
          const reply = await this.send(h, hook, current, actions, blocked.signal);
          if (reply.action === "block") blocked.abort();
          return reply;
        }),
      );
      outcome = replies.find((r) => r.action !== "continue");
      if (outcome) break;
      // Only a lone handler can have modified it.
      current = (replies[0] as { payload: HookPayload<K> }).payload;
    }
    for (const h of handlers) if (h.async) this.background(h, hook, current);
    return outcome ?? { action: "continue", payload: current };
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

  private bound(hook: HookName, payload: unknown): HookHandler[] {
    return this.handlers.filter((h) => h.event === hook && matches(hook, h.match, payload));
  }

  /** Never throws: a failed handler continues, or blocks when its onError is `fail`. */
  private async send<K extends HookName>(
    h: HookHandler,
    hook: K,
    payload: HookPayload<K>,
    actions: readonly HookAction[],
    stage: AbortSignal,
  ): Promise<HookOutcome<K>> {
    const proceed: HookOutcome<K> = { action: "continue" as const, payload };
    try {
      const signal = AbortSignal.any([AbortSignal.timeout(h.timeoutMs), stage]);
      const reply = await h.driver.handle(this.event(hook, payload, actions), h.options, signal);
      if (reply.action !== "continue" && !actions.includes(reply.action)) {
        throw new Error(`can't ${reply.action} here`);
      }
      const def: { payload: { parse(v: unknown): unknown }; respond?: { parse(v: unknown): unknown } } = HOOKS[hook];
      let outcome: HookOutcome<K>;
      if (reply.action === "block") outcome = { action: "block", reason: reply.reason };
      else if (reply.action === "respond") {
        outcome = { action: "respond", result: def.respond!.parse(reply.result) as HookRespond<K> };
      } else if (reply.action === "modify") {
        outcome = {
          action: "continue",
          payload: def.payload.parse({ ...payload, ...reply.payload }) as HookPayload<K>,
        };
      } else outcome = proceed;
      if (reply.metadata) Object.assign(this.metadata, reply.metadata);
      return outcome;
    } catch (err) {
      // Another handler of the stage blocked: this one's reply no longer matters.
      if (stage.aborted) return proceed;
      this.logger.warn(`hook ${hook} (${h.name}) on run ${this.ctx.run.id}: ${String(err)}`);
      return h.onError === "fail" ? { action: "block", reason: `hook "${h.name}" failed` } : proceed;
    }
  }

  private background(h: HookHandler, hook: HookName, payload: unknown): void {
    const p = h.driver
      .handle(this.event(hook, payload, []), h.options, AbortSignal.timeout(h.timeoutMs))
      .then(
        () => undefined,
        (err: unknown) => this.logger.warn(`hook ${hook} (${h.name}) on run ${this.ctx.run.id}: ${String(err)}`),
      )
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  private event(hook: HookName, payload: unknown, actions: readonly HookAction[]): HookEvent {
    const { run, agent, owner } = this.ctx;
    return {
      version: 1,
      id: randomUUID(),
      hook,
      actions: [...actions],
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
