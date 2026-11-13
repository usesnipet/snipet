import { AppContext } from "#src/common/context/app-context.js";
import { AgentRun } from "#src/modules/agent-run/agent-run.entity.js";
import { AgentMessage } from "#src/modules/agent-session/agent-message.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { In } from "typeorm";

import type { MessageStore } from "#src/core/store/message.store.js";
import type { LLMMessage } from "@snipet/shared/core";

/** The core's MessageStore on the agent_messages table. */
@Injectable()
export class DatabaseMessageStore extends BaseService<AppContext> implements MessageStore {
  async listRecent(ctx: AppContext, sessionId: string, runs: number): Promise<AgentMessage[]> {
    const recentRuns = await this.repositoryOf(ctx, AgentRun).find({
      select: { id: true },
      where: { sessionId },
      order: { createdAt: "DESC" },
      take: runs,
    });
    return this.repositoryOf(ctx, AgentMessage).find({
      where: { runId: In(recentRuns.map((run) => run.id)) },
      order: { id: "ASC" },
    });
  }

  add(ctx: AppContext, run: AgentRun, message: LLMMessage, model: string | null): Promise<AgentMessage> {
    const messages = this.repositoryOf(ctx, AgentMessage);
    return messages.save(messages.create({ sessionId: run.sessionId, runId: run.id, ...message, model }));
  }
}
