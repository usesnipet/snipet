import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AgentRunStatus } from "@snipet/shared";
import { IsNull, LessThan, MoreThan, Repository } from "typeorm";

import { AgentService } from "../agent/agent.service.js";

import { AgentMessage, AgentRun, AgentSession } from "./agent-run.entity.js";
import { AgentRunEvents } from "./agent-run.events.js";
import { AgentRunner } from "./agent-run.runner.js";

import type { FilterQuery } from "../../common/pagination/filter.js";
import type { Owner } from "../../common/decorators/owner.decorator.js";
import type {
  AgentRunEvent,
  FindAgentMessagesParams,
  FindAgentRunsParams,
  Paginated,
  StartAgentRun,
} from "@snipet/shared";

const TITLE_LENGTH = 80;

// Sessions, runs and their messages, always scoped to their owner: a
// session of someone else is a 404.
@Injectable()
export class AgentRunService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(AgentSession) private readonly sessions: Repository<AgentSession>,
    @InjectRepository(AgentRun) private readonly runs: Repository<AgentRun>,
    @InjectRepository(AgentMessage) private readonly messages: Repository<AgentMessage>,
    private readonly agents: AgentService,
    private readonly runner: AgentRunner,
    private readonly events: AgentRunEvents,
  ) {}

  // Runs are in-process, so the ones still running on boot were cut short.
  async onApplicationBootstrap() {
    await this.runs.update(
      { status: AgentRunStatus.RUNNING },
      { status: AgentRunStatus.FAILED, error: "interrupted by a server restart", finishedAt: new Date() },
    );
  }

  async findSessions(query: FilterQuery<AgentSession>, owner: Owner): Promise<Paginated<AgentSession>> {
    const [data, total] = await this.sessions.findAndCount({
      where: {
        ...query.where,
        userId: owner.userId ?? IsNull(),
        apiKeyId: owner.apiKeyId ?? IsNull(),
      },
      order: query.order,
      take: query.take,
      skip: query.skip,
    });
    return { data, total, take: query.take, skip: query.skip };
  }

  async findSession(id: string, owner: Owner): Promise<AgentSession> {
    const session = await this.sessions.findOneBy({
      id,
      userId: owner.userId ?? IsNull(),
      apiKeyId: owner.apiKeyId ?? IsNull(),
    });
    if (!session) throw new NotFoundException("AgentSession not found");
    return session;
  }

  async deleteSession(id: string, owner: Owner): Promise<void> {
    await this.findSession(id, owner);
    const running = await this.runs.findBy({ sessionId: id, status: AgentRunStatus.RUNNING });
    for (const run of running) this.events.abort(run.id);
    await this.sessions.delete(id);
  }

  // Newest first.
  async findMessages(
    sessionId: string,
    { take, before }: FindAgentMessagesParams,
    owner: Owner,
  ): Promise<Paginated<AgentMessage>> {
    await this.findSession(sessionId, owner);
    const [data, total] = await this.messages.findAndCount({
      where: { sessionId, ...(before ? { id: LessThan(before) } : {}) },
      order: { id: "DESC" },
      take,
    });
    return { data, total, take, skip: 0 };
  }

  // Newest first.
  async findRuns({ sessionId, take, skip }: FindAgentRunsParams, owner: Owner): Promise<Paginated<AgentRun>> {
    await this.findSession(sessionId, owner);
    const [data, total] = await this.runs.findAndCount({
      where: { sessionId },
      order: { createdAt: "DESC" },
      take,
      skip,
    });
    return { data, total, take, skip };
  }

  async findRun(id: string, owner: Owner): Promise<AgentRun> {
    const run = await this.runs.findOne({
      where: {
        id,
        session: {
          userId: owner.userId ?? IsNull(),
          apiKeyId: owner.apiKeyId ?? IsNull(),
        },
      },
    });
    if (!run) throw new NotFoundException("AgentRun not found");
    return run;
  }

  // Stores the input and answers it in the background; follow the run's
  // events for the answer.
  async start({ agentId, sessionId, input }: StartAgentRun, owner: Owner): Promise<AgentRun> {
    const agent = await this.agents.findById(agentId);
    if (!agent.enabled) throw new BadRequestException("agent is disabled");

    if (sessionId) {
      const session = await this.findSession(sessionId, owner);
      if (session.agentId !== agentId) throw new BadRequestException("the session belongs to another agent");
      if (await this.runs.existsBy({ sessionId, status: AgentRunStatus.RUNNING })) {
        throw new ConflictException("the session already has a running run");
      }
    }

    const run = await this.runs.manager.transaction(async (m) => {
      const sessions = m.getRepository(AgentSession);
      let id = sessionId;
      if (id) await sessions.update(id, { updatedAt: new Date() });
      else ({ id } = await sessions.save({ agentId, ...owner, title: input.split("\n")[0].slice(0, TITLE_LENGTH) }));
      const run = await m.getRepository(AgentRun).save({ sessionId: id, status: AgentRunStatus.RUNNING });
      await m.getRepository(AgentMessage).save({
        sessionId: id,
        runId: run.id,
        role: "user" as const,
        parts: [{ type: "text" as const, text: input }],
        model: null,
      });
      return m.getRepository(AgentRun).findOneByOrFail({ id: run.id });
    });

    void this.runner.run(agent, run);
    return run;
  }

  async cancel(id: string, owner: Owner): Promise<void> {
    const run = await this.findRun(id, owner);
    if (run.status !== AgentRunStatus.RUNNING) return;
    // Not live here: nothing is running it, just close it.
    if (!this.events.abort(id)) {
      await this.runs.update(id, { status: AgentRunStatus.CANCELLED, finishedAt: new Date() });
    }
  }

  // The run's stored messages after lastId, then its live events until it
  // finishes. Subscribes before reading, so nothing falls in between.
  async *follow(run: AgentRun, lastId: number, signal: AbortSignal): AsyncGenerator<AgentRunEvent> {
    const queue: AgentRunEvent[] = [];
    let wake: (() => void) | undefined;
    const unsubscribe = this.events.subscribe(run.id, (event) => {
      queue.push(event);
      wake?.();
    });
    const stop = () => wake?.();
    signal.addEventListener("abort", stop);

    try {
      const stored = await this.messages.find({ where: { runId: run.id, id: MoreThan(lastId) }, order: { id: "ASC" } });
      for (const message of stored) {
        lastId = message.id;
        yield { event: "message", data: message };
      }

      const current = await this.runs.findOneByOrFail({ id: run.id });
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
