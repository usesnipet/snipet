import { z } from "zod";

import { llmPartSchema, llmRoleSchema } from "./llm-message";

// A conversation with one agent, owned by a user or an API key subject.
export const agentSessionSchema = z
  .object({
    id: z.uuid(),
    agent_id: z.uuid(),
    user_id: z.uuid().nullable(),
    subject: z.string().nullable(),
    title: z.string(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();
export type AgentSession = z.infer<typeof agentSessionSchema>;

export const agentRunStatusSchema = z.enum(["running", "completed", "failed", "cancelled", "max_turns"]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

// One user message and the loop that answers it.
export const agentRunSchema = z
  .object({
    id: z.uuid(),
    session_id: z.uuid(),
    status: agentRunStatusSchema,
    error: z.string(),
    turns: z.number(),
    input_tokens: z.number(),
    output_tokens: z.number(),
    started_at: z.coerce.date(),
    finished_at: z.coerce.date().nullable(),
    created_at: z.coerce.date(),
  })
  .strict();
export type AgentRun = z.infer<typeof agentRunSchema>;

// One llm.Message of a session; id orders the conversation.
export const agentMessageSchema = z
  .object({
    id: z.number(),
    session_id: z.uuid(),
    run_id: z.uuid(),
    role: llmRoleSchema,
    parts: z.array(llmPartSchema),
    model: z.string().nullish(),
    input_tokens: z.number().nullish(),
    output_tokens: z.number().nullish(),
    tool_id: z.uuid().nullish(),
    duration_ms: z.number().nullish(),
    created_at: z.coerce.date(),
  })
  .strict();
export type AgentMessage = z.infer<typeof agentMessageSchema>;
