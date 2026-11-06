import { z } from "zod";

import { dataUrlSchema } from "../schemas/data-url.js";
import { jsonObjectSchema } from "../schemas/json.js";

import { hookNameSchema } from "./hook.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/**
 * One LLM of an agent; the runner tries them by ascending order. Same fields
 * as ExecuteLlmTarget: model is "llm/model", connectionId falls back to
 * the llm's default connection.
 */
export const agentLlmSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid(),
  order: z.number().int(),
  model: z.string(),
  connectionId: z.uuid().nullable(),
  extraOptions: jsonObjectSchema.nullable(),
});
export type AgentLlm = z.infer<typeof agentLlmSchema>;

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
  llms: z.array(agentLlmSchema),
  pluginConnections: z.array(agentPluginConnectionSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Agent = z.infer<typeof agentSchema>;

export const paginatedAgentSchema = paginatedSchema(agentSchema);

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
        model: z.string().regex(/^[^/]+\/.+$/, "Select a connection and a model"),
        connectionId: z.uuid().optional(),
        extraOptions: z.record(z.string(), z.unknown()).optional(),
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
