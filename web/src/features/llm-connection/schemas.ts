import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";

import { llmConnectionSchema } from "@/models/llm-connection";

export { llmConnectionSchema } from "@/models/llm-connection";
export type { LlmConnection } from "@/models/llm-connection";

export const createLlmConnectionSchema = llmConnectionSchema
  .pick({
    name: true,
    provider: true,
    config: true,
    enabled: true,
  })
  .strict();
export type CreateLlmConnection = z.infer<typeof createLlmConnectionSchema>;

export const updateLlmConnectionSchema = createLlmConnectionSchema.partial().strict();
export type UpdateLlmConnection = z.infer<typeof updateLlmConnectionSchema>;

export const paginatedLlmConnectionSchema = paginatedSchema(llmConnectionSchema);
export type PaginatedLlmConnection = z.infer<typeof paginatedLlmConnectionSchema>;

export const listLlmConnectionsSearchParamsSchema = paginationParamsSchema;
export type ListLlmConnectionsSearchParams = z.infer<
  typeof listLlmConnectionsSearchParamsSchema
>;

// Provider entry — the provider drivers available on the backend (llm.Info),
// as returned by GET /api/llm-connection/providers. No id and no relations, so it
// stays here rather than in @/models.
export const llmProviderSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    tags: z.array(z.string()).optional(),
    configuration_schema: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict();
export type LlmProvider = z.infer<
  typeof llmProviderSchema
>;

export const listLlmProviderSchema = z.array(llmProviderSchema);
export type ListLlmProvider = z.infer<typeof listLlmProviderSchema>;
