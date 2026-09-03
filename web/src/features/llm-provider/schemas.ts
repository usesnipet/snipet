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
