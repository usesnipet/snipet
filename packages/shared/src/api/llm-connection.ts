import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

/** A named, configured connection to an LLM. */
export const llmConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  llmKey: z.string(),
  config: jsonObjectSchema,
  enabled: z.boolean(),
  /**
   * The connection used for its llm when a call names none. Every llm
   * with connections has exactly one default.
   */
  default: z.boolean(),
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
  default: z.boolean().optional(),
});
export type CreateLlmConnection = z.infer<typeof createLlmConnectionSchema>;

export const updateLlmConnectionSchema = createLlmConnectionSchema.partial();
export type UpdateLlmConnection = z.infer<typeof updateLlmConnectionSchema>;

export const findLlmConnectionsParamsSchema = paginationParamsSchema.extend({
  llmKey: z.string().optional(),
});
export type FindLlmConnectionsParams = z.infer<typeof findLlmConnectionsParamsSchema>;
