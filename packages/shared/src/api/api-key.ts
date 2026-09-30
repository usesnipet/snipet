import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// Never carries the key hash.
export const apiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  // First chars of the key, safe to show to identify it.
  keyId: z.string(),
  active: z.boolean(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ApiKey = z.infer<typeof apiKeySchema>;

// Returned only on create and roll: the plaintext key is never stored.
export const apiKeyWithSecretSchema = apiKeySchema.extend({
  key: z.string(),
});
export type ApiKeyWithSecret = z.infer<typeof apiKeyWithSecretSchema>;

export const paginatedApiKeySchema = paginatedSchema(apiKeySchema);

// null = never expires.
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type CreateApiKey = z.infer<typeof createApiKeySchema>;

export const updateApiKeySchema = z.object({
  expiresAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateApiKey = z.infer<typeof updateApiKeySchema>;

export const findApiKeysParamsSchema = paginationParamsSchema;
export type FindApiKeysParams = z.infer<typeof findApiKeysParamsSchema>;
