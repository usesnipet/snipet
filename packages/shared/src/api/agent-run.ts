import { z } from "zod";

import { llmPartSchema, llmRoleSchema } from "./llm.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// A conversation with one agent, owned by a user of this system or by an
// app. externalUserId is the app's own id for its end user (null = the app itself).
export const agentSessionSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  userId: z.uuid().nullable(),
  appId: z.uuid().nullable(),
  externalUserId: z.string().nullable(),
  title: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AgentSession = z.infer<typeof agentSessionSchema>;

export const paginatedAgentSessionSchema = paginatedSchema(agentSessionSchema);

export const findAgentSessionsParamsSchema = paginationParamsSchema.extend({
  agentId: z.uuid().optional(),
});
export type FindAgentSessionsParams = z.infer<typeof findAgentSessionsParamsSchema>;

export enum AgentRunStatus {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  // The agent was still calling tools when it ran out of turns.
  MAX_TURNS = "max_turns",
}
export const agentRunStatusSchema = z.enum(AgentRunStatus);

// One user message and the loop that answers it. A turn is one LLM call.
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

// No sessionId starts a new session.
export const startAgentRunSchema = z.object({
  agentId: z.uuid(),
  sessionId: z.uuid().optional(),
  input: z.string().trim().min(1),
});
export type StartAgentRun = z.infer<typeof startAgentRunSchema>;

// One LlmMessage of a session; id orders the conversation. model is the
// "provider/model" that wrote an assistant message.
export const agentMessageSchema = z.object({
  id: z.number().int(),
  sessionId: z.uuid(),
  runId: z.uuid(),
  role: llmRoleSchema,
  parts: z.array(llmPartSchema),
  model: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AgentMessage = z.infer<typeof agentMessageSchema>;

export const paginatedAgentMessageSchema = paginatedSchema(agentMessageSchema);

// Newest first; before is a message id, for paging back.
export const findAgentMessagesParamsSchema = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  before: z.coerce.number().int().min(1).optional(),
});
export type FindAgentMessagesParams = z.infer<typeof findAgentMessagesParamsSchema>;

// SSE events of GET /agent-runs/:id/events. message events carry the
// message id as the SSE id, so a client resumes with Last-Event-ID.
export type AgentRunEvent =
  | { event: "text_delta"; data: { text: string } }
  | { event: "message"; data: AgentMessage }
  | { event: "run_finished"; data: AgentRun };
