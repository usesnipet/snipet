import { apiKeyBaseSchema, apiKeyKeySchema, apiKeySchema } from "@/models/api-key";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

export { apiKeyKeySchema, apiKeySchema } from "@/models/api-key";
export type { ApiKey, ApiKeyKey } from "@/models/api-key";

export const paginatedApiKeySchema = paginatedSchema(apiKeySchema);
export type PaginatedApiKey = z.infer<typeof paginatedApiKeySchema>;

export const listApiKeySearchParamsSchema = paginationParamsSchema;
export type ListApiKeySearchParams = z.infer<typeof listApiKeySearchParamsSchema>;

export const createApiKeySchema = apiKeyBaseSchema.pick({
  name: true,
  expires_at: true,
}).strict();

export type CreateApiKey = z.infer<typeof createApiKeySchema>;

export const updateApiKeyExpirationSchema = apiKeyBaseSchema.pick({
  expires_at: true,
}).strict();

export type UpdateApiKeyExpiration = z.infer<typeof updateApiKeyExpirationSchema>;

export const apiKeyWithSecretSchema = apiKeyBaseSchema.extend({
  key: apiKeyKeySchema,
}).strict();

export type ApiKeyWithSecret = z.infer<typeof apiKeyWithSecretSchema>;
