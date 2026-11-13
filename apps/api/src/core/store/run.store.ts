import type { AgentRun, AgentRunStatus } from "@snipet/shared";
import type { CoreContext } from "../context.js";

/** How a run ended. */
export interface RunOutcome {
  status: AgentRunStatus;
  /** Client-safe; null unless the run failed. */
  error: string | null;
  turns: number;
}

/** Where a run writes how it ended. */
export abstract class RunStore {
  /** Writes the outcome and returns the run as stored. */
  abstract finish(ctx: CoreContext, runId: string, outcome: RunOutcome): Promise<AgentRun>;
}
