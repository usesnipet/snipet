import { z } from "zod";

import { dataUrlSchema } from "../schemas/data-url.js";
import { jsonObjectSchema } from "../schemas/json.js";

import { hookNameSchema } from "./core/plugin/index.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** One LLM of an agent; the runner tries them by ascending order. Same fields as ExecuteLlmTarget. */
export const agentLLMSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  order: z.number().int(),
  model: z.string(),
  connectionId: z.uuid(),
});
export type AgentLLM = z.infer<typeof agentLLMSchema>;

/** Adds a plugin connection to an agent: its actions, hooks and settings. */
export const agentPluginConnectionSchema = z.object({
  agentId: z.uuid(),
  pluginConnectionId: z.uuid(),
  position: z.number().int(),
  tools: z.array(z.string()),
  settings: jsonObjectSchema,
  disabledHooks: z.array(hookNameSchema),
});
export type AgentPluginConnection = z.infer<typeof agentPluginConnectionSchema>;

export const agentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  /** Public URL of the avatar image. */
  avatar: z.url().nullable(),
  systemPrompt: z.string(),
  maxTurns: z.number().int(),
  historyRuns: z.number().int(),
  enabled: z.boolean(),
  llms: z.array(agentLLMSchema),
  pluginConnections: z.array(agentPluginConnectionSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Agent = z.infer<typeof agentSchema>;

/**
 * What GET /agents returns per agent. No prompt, limits, tools or settings:
 * those come from GET /agents/:id, when the agent is opened.
 */
export const agentSummarySchema = agentSchema
  .pick({
    id: true,
    name: true,
    description: true,
    avatar: true,
    enabled: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    /** In the order they run. */
    llms: z.array(agentLLMSchema.pick({ model: true })),
    /** In the order their hooks run; name is the connection's. */
    pluginConnections: z.array(z.object({ pluginConnectionId: z.uuid(), name: z.string() })),
  });
export type AgentSummary = z.infer<typeof agentSummarySchema>;

export const paginatedAgentSummarySchema = paginatedSchema(agentSummarySchema);

/** What GET /agents/available shows users who can't manage agents. */
export const availableAgentSchema = agentSchema.pick({ id: true, name: true, description: true, avatar: true });
export type AvailableAgent = z.infer<typeof availableAgentSchema>;

/**
 * The position in llms and pluginConnections is the order; both replace the whole list when sent.
 */
export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  description: z.string().optional(),
  avatar: z
    .union([dataUrlSchema.max(80_000, "Avatar is too large"), z.url()])
    .nullable()
    .optional(),
  systemPrompt: z.string().optional(),
  maxTurns: z
    .number()
    .int()
    .min(1, "Max turns must be at least 1")
    .max(500, "Max turns must be at most 500")
    .optional(),
  historyRuns: z
    .number()
    .int()
    .min(0, "History runs must be at least 0")
    .max(100, "History runs must be at most 100")
    .optional(),
  enabled: z.boolean().optional(),
  llms: z
    .array(
      z.object({
        model: z.string().min(1, "Select a model"),
        connectionId: z.uuid("Select a connection"),
      }),
    )
    .min(1, "Add at least one model"),
  pluginConnections: z
    .array(
      z.object({
        pluginConnectionId: z.uuid("Select a connection"),
        tools: z.array(z.string()).default([]),
        settings: jsonObjectSchema.default({}),
        disabledHooks: z.array(hookNameSchema).default([]),
      }),
    )
    .optional(),
});
export type CreateAgent = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema.partial();
export type UpdateAgent = z.infer<typeof updateAgentSchema>;

export const findAgentsParamsSchema = paginationParamsSchema;
export type FindAgentsParams = z.infer<typeof findAgentsParamsSchema>;
