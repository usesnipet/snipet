import { llmConnectionSchema } from "@/models/llm-connection";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

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

// One auth method a provider accepts (llm.Auth). "static" carries the JSON
// Schema its "auth" connection-options section must satisfy; "no-auth" needs
// no data at all.
export const llmProviderAuthSchema = z
  .object({
    type: z.enum(["no-auth", "static"]),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type LlmProviderAuth = z.infer<typeof llmProviderAuthSchema>;

// The JSON Schemas a provider declares (llm.Schemas): `config` validates the
// always-required "config" connection-options section (e.g. a base URL);
// `generate_extra_options`/`stream_extra_options` validate per-call options
// and aren't part of this connection form.
export const llmProviderSchemasSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).nullish(),
    generate_extra_options: z.record(z.string(), z.unknown()).nullish(),
    stream_extra_options: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict();
export type LlmProviderSchemas = z.infer<typeof llmProviderSchemasSchema>;

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
    auth: z.array(llmProviderAuthSchema),
    schemas: llmProviderSchemasSchema,
  })
  .strict();
export type LlmProvider = z.infer<
  typeof llmProviderSchema
>;

export const listLlmProviderSchema = z.array(llmProviderSchema);
export type ListLlmProvider = z.infer<typeof listLlmProviderSchema>;
