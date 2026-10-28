import { findAgentHooksParamsSchema, findHookConnectionsParamsSchema } from "@snipet/shared";

export {
  createAgentHookSchema,
  createHookConnectionSchema,
  updateAgentHookSchema,
  updateHookConnectionSchema,
} from "@snipet/shared";

export const findHookConnectionsSchema = findHookConnectionsParamsSchema.transform(({ hookKey, ...page }) => ({
  ...page,
  where: hookKey ? { hookKey } : undefined,
  order: { createdAt: "DESC" as const },
}));

export const findAgentHooksSchema = findAgentHooksParamsSchema.transform(({ agentId, hookConnectionId, ...page }) => ({
  ...page,
  where: { ...(agentId && { agentId }), ...(hookConnectionId && { hookConnectionId }) },
  order: { stage: "ASC" as const, position: "ASC" as const, createdAt: "ASC" as const },
}));
