import { findAgentSessionsParamsSchema } from "@snipet/shared";

export { findAgentMessagesParamsSchema } from "@snipet/shared";

export const findAgentSessionsSchema = findAgentSessionsParamsSchema.transform(({ agentId, ...page }) => ({
  ...page,
  where: agentId ? { agentId } : undefined,
  order: { updatedAt: "DESC" as const },
}));
