import { findApiKeysParamsSchema } from "@snipet/shared";

export { createApiKeySchema, updateApiKeySchema } from "@snipet/shared";

export const findApiKeysSchema = findApiKeysParamsSchema.transform(({ appId, ...page }) => ({
  ...page,
  where: appId ? { appId } : undefined,
  order: { createdAt: "DESC" as const },
}));
