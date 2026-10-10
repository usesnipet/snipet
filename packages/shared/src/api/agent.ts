import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// One LLM of an agent; the runner tries them by ascending order. Same fields
// as ExecuteLlmTarget: model is "provider/model", connectionId falls back to
// the provider's default connection.
export const agentLlmSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  order: z.number().int(),
  model: z.string(),
  connectionId: z.uuid().nullable(),
  extraOptions: z.record(z.string(), z.unknown()).nullable(),
});
export type AgentLlm = z.infer<typeof agentLlmSchema>;

// Grants an agent an MCP server's tools, narrowed by glob patterns on the
// tool name. Empty allow means every tool; deny wins.
export const agentMcpServerSchema = z.object({
  agentId: z.uuid(),
  mcpServerId: z.uuid(),
  allow: z.array(z.string()),
  deny: z.array(z.string()),
});
export type AgentMcpServer = z.infer<typeof agentMcpServerSchema>;

// Grants an agent a plugin connection's actions, narrowed the same way as
// agentMcpServerSchema.
export const agentPluginConnectionSchema = z.object({
  agentId: z.uuid(),
  pluginConnectionId: z.uuid(),
  allow: z.array(z.string()),
  deny: z.array(z.string()),
});
export type AgentPluginConnection = z.infer<typeof agentPluginConnectionSchema>;

export const agentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  maxTurns: z.number().int(),
  enabled: z.boolean(),
  llms: z.array(agentLlmSchema),
  mcpServers: z.array(agentMcpServerSchema),
  pluginConnections: z.array(agentPluginConnectionSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Agent = z.infer<typeof agentSchema>;

export const paginatedAgentSchema = paginatedSchema(agentSchema);

// Glob patterns; blanks are dropped.
const patternsSchema = z.array(z.string().trim()).transform((patterns) => patterns.filter(Boolean));

// The position in llms is the order. llms, mcpServers and pluginConnections
// replace the whole list when sent.
export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  maxTurns: z
    .number()
    .int()
    .min(1, "Max turns must be at least 1")
    .max(500, "Max turns must be at most 500")
    .optional(),
  enabled: z.boolean().optional(),
  llms: z
    .array(
      z.object({
        model: z.string().regex(/^[^/]+\/.+$/, "Select a provider and a model"),
        connectionId: z.uuid().optional(),
        extraOptions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1, "Add at least one model"),
  mcpServers: z
    .array(
      z.object({
        mcpServerId: z.uuid("Select a server"),
        allow: patternsSchema,
        deny: patternsSchema,
      }),
    )
    .optional(),
  pluginConnections: z
    .array(
      z.object({
        pluginConnectionId: z.uuid("Select a connection"),
        allow: patternsSchema,
        deny: patternsSchema,
      }),
    )
    .optional(),
});
export type CreateAgent = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema.partial();
export type UpdateAgent = z.infer<typeof updateAgentSchema>;

export const findAgentsParamsSchema = paginationParamsSchema;
export type FindAgentsParams = z.infer<typeof findAgentsParamsSchema>;
