import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// A named, configured connection to an LLM provider.
export const llmConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  provider: z.string(),
  config: jsonObjectSchema,
  enabled: z.boolean(),
  // The connection used for its provider when a call names none. Every
  // provider with connections has exactly one default.
  default: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type LlmConnection = z.infer<typeof llmConnectionSchema>;

export const paginatedLlmConnectionSchema = paginatedSchema(llmConnectionSchema);

export const createLlmConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  provider: z.string().min(1).max(255),
  config: jsonObjectSchema,
  enabled: z.boolean().optional(),
  default: z.boolean().optional(),
});
export type CreateLlmConnection = z.infer<typeof createLlmConnectionSchema>;

export const updateLlmConnectionSchema = createLlmConnectionSchema.partial();
export type UpdateLlmConnection = z.infer<typeof updateLlmConnectionSchema>;

export const findLlmConnectionsParamsSchema = paginationParamsSchema.extend({
  provider: z.string().optional(),
});
export type FindLlmConnectionsParams = z.infer<typeof findLlmConnectionsParamsSchema>;
