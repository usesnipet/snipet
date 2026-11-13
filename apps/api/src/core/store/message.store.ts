import type { AgentMessage, AgentRun } from "@snipet/shared";
import type { LLMMessage } from "@snipet/shared/core";
import type { CoreContext } from "../context.js";

/** Where a run reads its session's history and stores the messages it produces. */
export abstract class MessageStore {
  /** The messages of the session's last `runs` runs, oldest first. */
  abstract listRecent(ctx: CoreContext, sessionId: string, runs: number): Promise<AgentMessage[]>;

  /** Stores a message of the run; `model` is the "llm/model" that wrote an assistant message. */
  abstract add(ctx: CoreContext, run: AgentRun, message: LLMMessage, model: string | null): Promise<AgentMessage>;
}
