import { RunEvents } from "#src/core/run/run.events.js";
import { Injectable, NotFoundException } from "@nestjs/common";
import { CrudService } from "@snipet/server-common";
import { AgentRunStatus } from "@snipet/shared";
import { EntityManager, IsNull, LessThan } from "typeorm";

import { AgentRun } from "../agent-run/agent-run.entity.js";

import { AgentMessage } from "./agent-message.entity.js";
import { AgentSession } from "./agent-session.entity.js";

import type { FindAgentMessagesParams, Paginated } from "@snipet/shared";
import type { AppContext } from "#src/common/context/app-context.js";
import type { Owner } from "#src/core/context.js";
import type { FilterQuery } from "@snipet/server-common";
import type { DeepPartial } from "typeorm";

/** Where clause matching the sessions of `owner`, a null owner field matching only null. */
export const ownedBy = (owner: Owner) => ({
  userId: owner.userId ?? IsNull(),
  appId: owner.appId ?? IsNull(),
  externalUserId: owner.externalUserId ?? IsNull(),
});

/** The caller's sessions and their messages: every read and write is scoped to ctx.owner. */
@Injectable()
export class AgentSessionService extends CrudService<AgentSession, AppContext> {
  constructor(
    manager: EntityManager,
    private readonly runEvents: RunEvents,
  ) {
    super(manager, AgentSession);
  }

  override filter(ctx: AppContext, query: FilterQuery<AgentSession>): Promise<Paginated<AgentSession>> {
    return super.filter(ctx, { ...query, where: { ...query.where, ...ownedBy(ctx.owner) } });
  }

  override async findById(ctx: AppContext, id: string): Promise<AgentSession> {
    const session = await this.repository(ctx).findOneBy({ id, ...ownedBy(ctx.owner) });
    if (!session) throw new NotFoundException("AgentSession not found");
    return session;
  }

  /** A session of the caller: the owner always comes from ctx, never from dto. */
  override create(ctx: AppContext, dto: DeepPartial<AgentSession>): Promise<AgentSession> {
    return super.create(ctx, { ...dto, ...ctx.owner });
  }

  /**
   * Deletes the session with its runs and messages, aborting its running runs
   * first. One started in between isn't aborted: the cascade deletes it, and
   * the runner drops what it can no longer write.
   */
  override async deleteById(ctx: AppContext, id: string): Promise<void> {
    await this.findById(ctx, id);
    const runningRuns = await this.repositoryOf(ctx, AgentRun).findBy({
      sessionId: id,
      status: AgentRunStatus.RUNNING,
    });
    for (const run of runningRuns) this.runEvents.abort(run.id);
    await super.deleteById(ctx, id);
  }

  async findMessages(
    ctx: AppContext,
    sessionId: string,
    { take, before }: FindAgentMessagesParams,
  ): Promise<Paginated<AgentMessage>> {
    await this.findById(ctx, sessionId);
    const [data, total] = await this.repositoryOf(ctx, AgentMessage).findAndCount({
      where: { sessionId, ...(before ? { id: LessThan(before) } : {}) },
      order: { id: "DESC" },
      take,
    });
    return { data, total, take, skip: 0 };
  }
}
