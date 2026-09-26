import { agentSchema } from "@/models/agent";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

export { agentLlmSchema, agentMcpServerSchema, agentSchema } from "@/models/agent";
export type { Agent, AgentLlm, AgentMcpServer } from "@/models/agent";

// Glob patterns typed as a comma-separated line; blanks are dropped.
const patternsSchema = z.array(z.string()).transform((patterns) => patterns.map((p) => p.trim()).filter(Boolean));

// Body of POST /api/agent; the position in llms is the order.
export const createAgentSchema = agentSchema
  .pick({ name: true, description: true, max_turns: true, system_prompt: true, enabled: true })
  .extend({
    llms: z
      .array(
        z.object({
          model: z.string().regex(/^[^/]+\/.+$/, "Select a provider and a model"),
          llm_connection_id: z.uuid().optional(),
          extra_options: z.record(z.string(), z.unknown()).optional(),
        }).strict(),
      )
      .min(1, "Add at least one model"),
    mcp_servers: z.array(
      z.object({
        mcp_server_id: z.uuid("Select a server"),
        allow: patternsSchema,
        deny: patternsSchema,
      }).strict(),
    ),
  })
  .strict();
export type CreateAgentInput = z.input<typeof createAgentSchema>;
export type CreateAgent = z.output<typeof createAgentSchema>;

// Body of PUT /api/agent/{id}: the create body with every field optional.
export const updateAgentSchema = createAgentSchema.partial().strict();
export type UpdateAgent = z.output<typeof updateAgentSchema>;

export const paginatedAgentSchema = paginatedSchema(agentSchema);
export type PaginatedAgent = z.infer<typeof paginatedAgentSchema>;

export const listAgentsSearchParamsSchema = paginationParamsSchema;
export type ListAgentsSearchParams = z.infer<typeof listAgentsSearchParamsSchema>;
