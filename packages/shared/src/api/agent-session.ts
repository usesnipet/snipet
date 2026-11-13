import { z } from "zod";

import { llmPartSchema, llmRoleSchema } from "./core/index.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/**
 * A conversation with one agent, owned by a user of this system or by an
 * app. externalUserId is the app's own id for its end user (null = the app itself).
 */
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

/**
 * One LlmMessage of a session; id orders the conversation. model is the
 * "llm/model" that wrote an assistant message.
 */
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

/** Newest first; before is a message id, for paging back. */
export const findAgentMessagesParamsSchema = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  before: z.coerce.number().int().min(1).optional(),
});
export type FindAgentMessagesParams = z.infer<typeof findAgentMessagesParamsSchema>;
