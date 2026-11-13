import z from "zod";

import { agentRunSchema } from "../../agent-run.js";
import { agentMessageSchema } from "../../agent-session.js";

export enum RunEventType {
  TEXT_DELTA = "text_delta",
  MESSAGE = "message",
  RUN_FINISHED = "run_finished",
}

/**
 * SSE events of GET /agent-runs/:id/events. message events carry the
 * message id as the SSE id, so a client resumes with Last-Event-ID.
 */
export const runEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal(RunEventType.TEXT_DELTA), data: z.object({ text: z.string() }) }),
  z.object({ event: z.literal(RunEventType.MESSAGE), data: z.object({ message: agentMessageSchema }) }),
  z.object({ event: z.literal(RunEventType.RUN_FINISHED), data: z.object({ run: agentRunSchema }) }),
]);
export type RunEvent = z.infer<typeof runEventSchema>;
