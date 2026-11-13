import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";

import { llmMessageSchema, llmToolSchema } from "./core/index.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** A named, configured connection to an LLM. */
export const llmConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  llmKey: z.string(),
  config: jsonObjectSchema,
  enabled: z.boolean(),
  lastSyncedAt: z.coerce.date().nullable(),
  lastSyncedError: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type LlmConnection = z.infer<typeof llmConnectionSchema>;

export const paginatedLlmConnectionSchema = paginatedSchema(llmConnectionSchema);

export const createLlmConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  llmKey: z.string().min(1).max(255),
  config: jsonObjectSchema,
  enabled: z.boolean().optional(),
});
export type CreateLlmConnection = z.infer<typeof createLlmConnectionSchema>;

export const updateLlmConnectionSchema = createLlmConnectionSchema.partial();
export type UpdateLlmConnection = z.infer<typeof updateLlmConnectionSchema>;

export const findLlmConnectionsParamsSchema = paginationParamsSchema.extend({
  llmKey: z.string().optional(),
});
export type FindLlmConnectionsParams = z.infer<typeof findLlmConnectionsParamsSchema>;

/** connectionId: the connection whose synced models to list. */
export const listLLMModelsParamsSchema = z.object({
  connectionId: z.uuid(),
});
export type ListLLMModelsParams = z.infer<typeof listLLMModelsParamsSchema>;

// --- execute -------------------------------------------------------------
export const executeLLMTargetSchema = z.object({
  connectionId: z.uuid(),
  model: z.string().min(1),
});
export type ExecuteLLMTarget = z.infer<typeof executeLLMTargetSchema>;

export const executeLLMSchema = z.object({
  targets: z.array(executeLLMTargetSchema).min(1),
  messages: z.array(llmMessageSchema).min(1),
  tools: z.array(llmToolSchema).optional(),
});
export type ExecuteLLM = z.infer<typeof executeLLMSchema>;
