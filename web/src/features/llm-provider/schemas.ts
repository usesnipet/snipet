import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";

import { llmProviderSchema } from "@/models/llm-provider";

export { llmProviderSchema } from "@/models/llm-provider";
export type { LlmProvider } from "@/models/llm-provider";

export const createLlmProviderSchema = llmProviderSchema
  .pick({
    name: true,
    provider: true,
    config: true,
    enabled: true,
  })
  .strict();
export type CreateLlmProvider = z.infer<typeof createLlmProviderSchema>;

export const updateLlmProviderSchema = createLlmProviderSchema.partial().strict();
export type UpdateLlmProvider = z.infer<typeof updateLlmProviderSchema>;

export const paginatedLlmProviderSchema = paginatedSchema(llmProviderSchema);
export type PaginatedLlmProvider = z.infer<typeof paginatedLlmProviderSchema>;

export const listLlmProvidersSearchParamsSchema = paginationParamsSchema;
export type ListLlmProvidersSearchParams = z.infer<
  typeof listLlmProvidersSearchParamsSchema
>;

// Registry entry — the provider drivers available on the backend (llm.Info),
// as returned by GET /api/llm-provider/registry. No id and no relations, so it
// stays here rather than in @/models.
export const llmProviderRegistryEntrySchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    tags: z.array(z.string()).optional(),
    configuration_schema: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict();
export type LlmProviderRegistryEntry = z.infer<
  typeof llmProviderRegistryEntrySchema
>;

export const llmProviderRegistrySchema = z.array(llmProviderRegistryEntrySchema);
export type LlmProviderRegistry = z.infer<typeof llmProviderRegistrySchema>;
