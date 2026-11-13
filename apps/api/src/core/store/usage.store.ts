import type { Agent, AgentRun } from "@snipet/shared";
import type { LLMUsage } from "@snipet/shared/core";
import type { CoreContext } from "../context.js";

/** One LLM call: the target that answered it and what the provider reported. */
export interface LLMCall {
  connectionId: string;
  model: string;
  usage: LLMUsage;
}

/** Where a run records the tokens each of its LLM calls used. */
export abstract class UsageStore {
  abstract record(ctx: CoreContext, agent: Agent, run: AgentRun, call: LLMCall): Promise<void>;
}
