import { findAgentsParamsSchema } from "@snipet/shared";

export { createAgentSchema, updateAgentSchema } from "@snipet/shared";

export const findAgentsSchema = findAgentsParamsSchema.transform((page) => ({
  ...page,
  order: { createdAt: "DESC" as const },
}));
