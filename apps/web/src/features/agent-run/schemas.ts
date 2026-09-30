import { agentMessageSchema, agentRunSchema, agentSessionSchema } from "@/models/agent-run";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

import type { AgentMessage, AgentRun } from "@/models/agent-run";

export { agentMessageSchema, agentRunSchema, agentSessionSchema } from "@/models/agent-run";
export type { AgentMessage, AgentRun, AgentSession } from "@/models/agent-run";

// Body of POST /agent-run; no session_id starts a new session.
export const startRunSchema = z
  .object({
    agent_id: z.uuid(),
    session_id: z.uuid().optional(),
    input: z.string().trim().min(1),
  })
  .strict();
export type StartRun = z.infer<typeof startRunSchema>;

export const paginatedAgentSessionSchema = paginatedSchema(agentSessionSchema);
export type PaginatedAgentSession = z.infer<typeof paginatedAgentSessionSchema>;

export const listSessionsSearchParamsSchema = paginationParamsSchema
  .extend({ agent_id: z.uuid().optional() })
  .strict();
export type ListSessionsSearchParams = z.infer<typeof listSessionsSearchParamsSchema>;

export const paginatedAgentMessageSchema = paginatedSchema(agentMessageSchema);
export type PaginatedAgentMessage = z.infer<typeof paginatedAgentMessageSchema>;

export const listMessagesSearchParamsSchema = z
  .object({ take: z.number().min(1).max(500).optional(), before: z.number().min(1).optional() })
  .strict();
export type ListMessagesSearchParams = z.infer<typeof listMessagesSearchParamsSchema>;

export const paginatedAgentRunSchema = paginatedSchema(agentRunSchema);
export type PaginatedAgentRun = z.infer<typeof paginatedAgentRunSchema>;

export const listRunsSearchParamsSchema = paginationParamsSchema
  .extend({ session_id: z.uuid() })
  .strict();
export type ListRunsSearchParams = z.infer<typeof listRunsSearchParamsSchema>;

// --- SSE events of GET /agent-run/{id}/events

type ToolCallStartedData = { call_id: string; name: string; tool_id: string | null };

// The events the playground reacts to; others (turn_started, llm_*) are ignored.
export type AgentRunEvent =
  | { event: "run_started"; data: AgentRun }
  | { event: "text_delta"; data: { text: string } }
  | { event: "tool_call_started"; data: ToolCallStartedData }
  | { event: "message"; data: AgentMessage }
  | { event: "run_finished"; data: AgentRun }
  | { event: "error"; data: { message: string } };
