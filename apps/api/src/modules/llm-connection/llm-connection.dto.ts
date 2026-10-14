import { findLlmConnectionsParamsSchema } from "@snipet/shared";

export { createLlmConnectionSchema, updateLlmConnectionSchema } from "@snipet/shared";

export const findLlmConnectionsSchema = findLlmConnectionsParamsSchema.transform(({ llmKey, ...page }) => ({
  ...page,
  where: llmKey ? { llmKey } : undefined,
  order: { createdAt: "DESC" as const },
}));
