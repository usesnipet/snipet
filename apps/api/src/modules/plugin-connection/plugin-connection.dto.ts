import { findPluginConnectionsParamsSchema } from "@snipet/shared";

export { createPluginConnectionSchema, updatePluginConnectionSchema } from "@snipet/shared";

export const findPluginConnectionsSchema = findPluginConnectionsParamsSchema.transform(({ pluginKey, ...page }) => ({
  ...page,
  where: pluginKey ? { pluginKey } : undefined,
  order: { createdAt: "DESC" as const },
}));
