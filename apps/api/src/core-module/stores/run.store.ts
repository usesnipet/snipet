import { AppContext } from "#src/common/context/app-context.js";
import { AgentRun } from "#src/modules/agent-run/agent-run.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";

import type { RunOutcome, RunStore } from "#src/core/store/run.store.js";

/** The core's RunStore on the agent_runs table. */
@Injectable()
export class DatabaseRunStore extends BaseService<AppContext> implements RunStore {
  async finish(ctx: AppContext, runId: string, { status, error, turns }: RunOutcome): Promise<AgentRun> {
    const runs = this.repositoryOf(ctx, AgentRun);
    await runs.update(runId, { status, error, turns, finishedAt: new Date() });
    return runs.findOneByOrFail({ id: runId });
  }
}
