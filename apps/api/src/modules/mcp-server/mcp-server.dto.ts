import { findMcpServersParamsSchema } from "@snipet/shared";

export { createMcpServerSchema, updateMcpServerSchema } from "@snipet/shared";

export const findMcpServersSchema = findMcpServersParamsSchema.transform((page) => ({
  ...page,
  order: { createdAt: "DESC" as const },
}));
