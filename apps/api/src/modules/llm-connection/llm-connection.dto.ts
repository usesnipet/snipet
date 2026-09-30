import { findLlmConnectionsParamsSchema } from "@snipet/shared";

export { createLlmConnectionSchema, updateLlmConnectionSchema } from "@snipet/shared";

export const findLlmConnectionsSchema = findLlmConnectionsParamsSchema.transform(({ provider, ...page }) => ({
  ...page,
  where: provider ? { provider } : undefined,
  order: { createdAt: "DESC" as const },
}));
