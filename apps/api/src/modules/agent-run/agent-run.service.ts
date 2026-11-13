import { AppContext } from "#src/common/context/app-context.js";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { AgentRunStatus } from "@snipet/shared";
import { LLMMessagePartType, LLMRole, RunEvent, RunEventType } from "@snipet/shared/core";
import { EntityManager, MoreThan } from "typeorm";

import { AgentRunner } from "../../core/run/agent.runner.js";
import { RunEvents } from "../../core/run/run.events.js";
import { AgentMessage } from "../agent-session/agent-message.entity.js";
import { AgentSessionService, ownedBy } from "../agent-session/agent-session.service.js";
import { sessionTitleOf } from "../agent-session/session-title.js";
import { AgentService } from "../agent/agent.service.js";

import { AgentRun } from "./agent-run.entity.js";

import type { FindAgentRunsParams, Paginated, StartAgentRun } from "@snipet/shared";
@Injectable()
export class AgentRunService extends BaseService<AppContext> implements OnApplicationBootstrap {
  constructor(
    manager: EntityManager,
    private readonly agents: AgentService,
    private readonly sessionService: AgentSessionService,
    private readonly runner: AgentRunner,
    private readonly runEvents: RunEvents,
  ) {
    super(manager);
  }

  async onApplicationBootstrap() {
    const ctx = AppContext.create("bootstrap:agent-runs");
    await this.repositoryOf(ctx, AgentRun).update(
      { status: AgentRunStatus.RUNNING },
      { status: AgentRunStatus.FAILED, error: "interrupted by a server restart", finishedAt: new Date() },
    );
  }

  async findRuns(ctx: AppContext, { sessionId, take, skip }: FindAgentRunsParams): Promise<Paginated<AgentRun>> {
    await this.sessionService.findById(ctx, sessionId);
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
      const session = await this.sessionService.findById(ctx, sessionId);
      if (session.agentId !== agentId) throw new BadRequestException("the session belongs to another agent");
      if (await this.repositoryOf(ctx, AgentRun).existsBy({ sessionId, status: AgentRunStatus.RUNNING })) {
        throw new ConflictException("the session already has a running run");
      }
    }

    const run = await this.transaction(ctx, async (ctx) => {
      const runsRepo = this.repositoryOf(ctx, AgentRun);
      let id = sessionId;
      if (id) await this.sessionService.updateById(ctx, id, { updatedAt: new Date() });
      else ({ id } = await this.sessionService.create(ctx, { agentId, title: sessionTitleOf(input) }));
      const run = await runsRepo.save({ sessionId: id, status: AgentRunStatus.RUNNING });
      await this.repositoryOf(ctx, AgentMessage).save({
        sessionId: id,
        runId: run.id,
        role: LLMRole.USER,
        parts: [{ type: LLMMessagePartType.TEXT as const, text: input }],
        model: null,
      });
      return runsRepo.findOneByOrFail({ id: run.id });
    });

    // Outlives the request: the runner gets the request's context, outside the transaction.
    void this.runner.run(ctx, agent, run);
    return run;
  }

  async cancel(ctx: AppContext, id: string): Promise<void> {
    const run = await this.findRun(ctx, id);
    if (run.status !== AgentRunStatus.RUNNING) return;
    // Not live here: nothing is running it, just close it.
    if (!this.runEvents.abort(id)) {
      await this.repositoryOf(ctx, AgentRun).update(id, { status: AgentRunStatus.CANCELLED, finishedAt: new Date() });
    }
  }

  /**
   * The run's stored messages after lastId, then its live events until it
   * finishes. Subscribes before reading, so nothing falls in between.
   */
  async *follow(ctx: AppContext, run: AgentRun, lastId: number, signal: AbortSignal): AsyncGenerator<RunEvent> {
    const queue: RunEvent[] = [];
    let wake: (() => void) | undefined;
    const unsubscribe = this.runEvents.subscribe(run.id, (event) => {
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
        yield { event: RunEventType.MESSAGE, data: { message } };
      }

      const current = await this.repositoryOf(ctx, AgentRun).findOneByOrFail({ id: run.id });
      if (!unsubscribe || current.status !== AgentRunStatus.RUNNING) {
        yield { event: RunEventType.RUN_FINISHED, data: { run: current } };
        return;
      }

      while (!signal.aborted) {
        const event = queue.shift();
        if (!event) {
          await new Promise<void>((resolve) => (wake = resolve));
          continue;
        }
        if (event.event === RunEventType.MESSAGE && event.data.message.id <= lastId) continue;
        yield event;
        if (event.event === RunEventType.RUN_FINISHED) return;
      }
    } finally {
      unsubscribe?.();
      signal.removeEventListener("abort", stop);
    }
  }
}
