import { AppContext } from "#src/common/context/app-context.js";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { AgentRunStatus } from "@snipet/shared";
import { EntityManager, EntityTarget, IsNull, LessThan, MoreThan, ObjectLiteral, Repository } from "typeorm";

import { AgentService } from "../agent/agent.service.js";

import { AgentMessage, AgentRun, AgentSession } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";
import { AgentRunner } from "./agent-run.runner.js";
import { sessionTitleOf } from "./session-title.js";

import type { Owner } from "#src/core/context.js";
import type { FilterQuery } from "@snipet/server-common";
import type {
  AgentRunEvent,
  FindAgentMessagesParams,
  FindAgentRunsParams,
  Paginated,
  StartAgentRun,
} from "@snipet/shared";

const ownedBy = (owner: Owner) => ({
  userId: owner.userId ?? IsNull(),
  appId: owner.appId ?? IsNull(),
  externalUserId: owner.externalUserId ?? IsNull(),
});

@Injectable()
export class AgentRunService implements OnApplicationBootstrap {
  constructor(
    private readonly manager: EntityManager,
    private readonly agents: AgentService,
    private readonly runner: AgentRunner,
    private readonly events: AgentRunEvents,
  ) {}

  /** A table, joining the context's transaction when there is one. */
  private repositoryOf<E extends ObjectLiteral>(ctx: AppContext, target: EntityTarget<E>): Repository<E> {
    return (ctx.tx ?? this.manager).getRepository(target);
  }

  /** Runs fn in a transaction, reusing the context's one if it's already in one. */
  private transaction<R>(ctx: AppContext, fn: (ctx: AppContext) => Promise<R>): Promise<R> {
    return ctx.tx ? fn(ctx) : this.manager.transaction((tx) => fn(ctx.withTx(tx)));
  }

  async onApplicationBootstrap() {
    const ctx = AppContext.create("bootstrap:agent-runs");
    await this.repositoryOf(ctx, AgentRun).update(
      { status: AgentRunStatus.RUNNING },
      { status: AgentRunStatus.FAILED, error: "interrupted by a server restart", finishedAt: new Date() },
    );
  }

  async findSessions(ctx: AppContext, query: FilterQuery<AgentSession>): Promise<Paginated<AgentSession>> {
    const [data, total] = await this.repositoryOf(ctx, AgentSession).findAndCount({
      where: {
        ...query.where,
        ...ownedBy(ctx.owner),
      },
      order: query.order,
      take: query.take,
      skip: query.skip,
    });
    return { data, total, take: query.take, skip: query.skip };
  }

  async findSession(ctx: AppContext, id: string): Promise<AgentSession> {
    const session = await this.repositoryOf(ctx, AgentSession).findOneBy({ id, ...ownedBy(ctx.owner) });
    if (!session) throw new NotFoundException("AgentSession not found");
    return session;
  }

  async deleteSession(ctx: AppContext, id: string): Promise<void> {
    await this.findSession(ctx, id);
    const running = await this.repositoryOf(ctx, AgentRun).findBy({ sessionId: id, status: AgentRunStatus.RUNNING });
    for (const run of running) this.events.abort(run.id);
    await this.repositoryOf(ctx, AgentSession).delete(id);
  }

  async findMessages(
    ctx: AppContext,
    sessionId: string,
    { take, before }: FindAgentMessagesParams,
  ): Promise<Paginated<AgentMessage>> {
    await this.findSession(ctx, sessionId);
    const [data, total] = await this.repositoryOf(ctx, AgentMessage).findAndCount({
      where: { sessionId, ...(before ? { id: LessThan(before) } : {}) },
      order: { id: "DESC" },
      take,
    });
    return { data, total, take, skip: 0 };
  }

  async findRuns(ctx: AppContext, { sessionId, take, skip }: FindAgentRunsParams): Promise<Paginated<AgentRun>> {
    await this.findSession(ctx, sessionId);
    const [data, total] = await this.repositoryOf(ctx, AgentRun).findAndCount({
      where: { sessionId },
      order: { createdAt: "DESC" },
      take,
      skip,
    });
    return { data, total, take, skip };
  }

  async findRun(ctx: AppContext, id: string): Promise<AgentRun> {
    const run = await this.repositoryOf(ctx, AgentRun).findOne({
      where: {
        id,
        session: ownedBy(ctx.owner),
      },
    });
    if (!run) throw new NotFoundException("AgentRun not found");
    return run;
  }

  /**
   * Stores the input and answers it in the background; follow the run's
   * events for the answer.
   */
  async start(ctx: AppContext, { agentId, sessionId, input }: StartAgentRun): Promise<AgentRun> {
    const agent = await this.agents.findById(ctx, agentId);
    if (!agent.enabled) throw new BadRequestException("agent is disabled");

    if (sessionId) {
      const session = await this.findSession(ctx, sessionId);
      if (session.agentId !== agentId) throw new BadRequestException("the session belongs to another agent");
      if (await this.repositoryOf(ctx, AgentRun).existsBy({ sessionId, status: AgentRunStatus.RUNNING })) {
        throw new ConflictException("the session already has a running run");
      }
    }

    const run = await this.transaction(ctx, async (ctx) => {
      const sessions = this.repositoryOf(ctx, AgentSession);
      const runs = this.repositoryOf(ctx, AgentRun);
      let id = sessionId;
      if (id) await sessions.update(id, { updatedAt: new Date() });
      else ({ id } = await sessions.save({ agentId, ...ctx.owner, title: sessionTitleOf(input) }));
      const run = await runs.save({ sessionId: id, status: AgentRunStatus.RUNNING });
      await this.repositoryOf(ctx, AgentMessage).save({
        sessionId: id,
        runId: run.id,
        role: "user" as const,
        parts: [{ type: "text" as const, text: input }],
        model: null,
      });
      return runs.findOneByOrFail({ id: run.id });
    });

    // Outlives the request: the runner gets the request's context, outside the transaction.
    void this.runner.run(ctx, agent, run);
    return run;
  }

  async cancel(ctx: AppContext, id: string): Promise<void> {
    const run = await this.findRun(ctx, id);
    if (run.status !== AgentRunStatus.RUNNING) return;
    // Not live here: nothing is running it, just close it.
    if (!this.events.abort(id)) {
      await this.repositoryOf(ctx, AgentRun).update(id, { status: AgentRunStatus.CANCELLED, finishedAt: new Date() });
    }
  }

  /**
   * The run's stored messages after lastId, then its live events until it
   * finishes. Subscribes before reading, so nothing falls in between.
   */
  async *follow(ctx: AppContext, run: AgentRun, lastId: number, signal: AbortSignal): AsyncGenerator<AgentRunEvent> {
    const queue: AgentRunEvent[] = [];
    let wake: (() => void) | undefined;
    const unsubscribe = this.events.subscribe(run.id, (event) => {
      queue.push(event);
      wake?.();
    });
    const stop = () => wake?.();
    signal.addEventListener("abort", stop);

    try {
      const stored = await this.repositoryOf(ctx, AgentMessage).find({
        where: { runId: run.id, id: MoreThan(lastId) },
        order: { id: "ASC" },
      });
      for (const message of stored) {
        lastId = message.id;
        yield { event: "message", data: message };
      }

      const current = await this.repositoryOf(ctx, AgentRun).findOneByOrFail({ id: run.id });
      if (!unsubscribe || current.status !== AgentRunStatus.RUNNING) {
        yield { event: "run_finished", data: current };
        return;
      }

      while (!signal.aborted) {
        const event = queue.shift();
        if (!event) {
          await new Promise<void>((resolve) => (wake = resolve));
          continue;
        }
        if (event.event === "message" && event.data.id <= lastId) continue;
        yield event;
        if (event.event === "run_finished") return;
      }
    } finally {
      unsubscribe?.();
      signal.removeEventListener("abort", stop);
    }
  }
}
