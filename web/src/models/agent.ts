import { z } from "zod";

import { mcpServerSchema } from "./mcp-server";

// One LLM of an agent; the runner tries them by ascending order.
export const agentLlmSchema = z
  .object({
    id: z.uuid(),
    agent_id: z.uuid(),
    order: z.number().int(),
    model: z.string(),
    llm_connection_id: z.uuid().nullish(),
    extra_options: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict();
export type AgentLlm = z.infer<typeof agentLlmSchema>;

// Grants an agent an MCP server's tools, narrowed by glob patterns on the
// tool name. Empty allow means every tool; deny wins.
export const agentMcpServerSchema = z
  .object({
    agent_id: z.uuid(),
    mcp_server_id: z.uuid(),
    mcp_server: mcpServerSchema.optional(),
    allow: z.array(z.string()),
    deny: z.array(z.string()),
  })
  .strict();
export type AgentMcpServer = z.infer<typeof agentMcpServerSchema>;

// The Agent entity — the read model as it comes off the API.
export const agentSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, "Name is required").max(255),
    description: z.string(),
    system_prompt: z.string(),
    max_turns: z.coerce.number<string | number>().int().min(1, "Max turns must be at least 1").max(500, "Max turns must be less than 500"),
    enabled: z.boolean(),
    llms: z.array(agentLlmSchema).nullish(),
    mcp_servers: z.array(agentMcpServerSchema).nullish(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();
export type Agent = z.infer<typeof agentSchema>;
