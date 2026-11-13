import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

export enum AgentRunStatus {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  /** The agent was still calling tools when it ran out of turns. */
  MAX_TURNS = "max_turns",
}
export const agentRunStatusSchema = z.enum(AgentRunStatus);

/** One user message and the loop that answers it. A turn is one LLM call. */
export const agentRunSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  status: agentRunStatusSchema,
  error: z.string().nullable(),
  turns: z.number().int(),
  finishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AgentRun = z.infer<typeof agentRunSchema>;

export const paginatedAgentRunSchema = paginatedSchema(agentRunSchema);

export const findAgentRunsParamsSchema = paginationParamsSchema.extend({
  sessionId: z.uuid(),
});
export type FindAgentRunsParams = z.infer<typeof findAgentRunsParamsSchema>;

/** No sessionId starts a new session. */
export const startAgentRunSchema = z.object({
  agentId: z.uuid(),
  sessionId: z.uuid().optional(),
  input: z.string().trim().min(1),
});
export type StartAgentRun = z.infer<typeof startAgentRunSchema>;
