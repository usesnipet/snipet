import { LLMStreamEvent, LLMStreamEventType } from "../llm/stream.js";

export enum RunEventType {
  RUN_FINISHED = "run_finished",
}

/**
 * SSE events of GET /agent-runs/:id/events. message events carry the
 * message id as the SSE id, so a client resumes with Last-Event-ID.
 */
export type RunEvent =
  | Extract<
      LLMStreamEvent,
      {
        event:
          | LLMStreamEventType.LLM_STARTED
          | LLMStreamEventType.LLM_SKIPPED
          | LLMStreamEventType.TEXT_DELTA
          | LLMStreamEventType.THINKING_DELTA
          | LLMStreamEventType.USAGE
          | LLMStreamEventType.TOOL_CALL
          | LLMStreamEventType.MESSAGE
          | LLMStreamEventType.ERROR;
      }
    >
  | { event: RunEventType.RUN_FINISHED };
