import { findAgentSessionsParamsSchema } from "@snipet/shared";

export { findAgentMessagesParamsSchema, findAgentRunsParamsSchema, startAgentRunSchema } from "@snipet/shared";

// Most recently active first.
export const findAgentSessionsSchema = findAgentSessionsParamsSchema.transform(({ agentId, ...page }) => ({
  ...page,
  where: agentId ? { agentId } : undefined,
  order: { updatedAt: "DESC" as const },
}));
