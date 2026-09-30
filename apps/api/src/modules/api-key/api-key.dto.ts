import { findApiKeysParamsSchema } from "@snipet/shared";

export { createApiKeySchema, updateApiKeySchema } from "@snipet/shared";

export const findApiKeysSchema = findApiKeysParamsSchema.transform((page) => ({
  ...page,
  order: { createdAt: "DESC" as const },
}));
