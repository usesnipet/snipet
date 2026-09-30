import { findToolsParamsSchema } from "@snipet/shared";
import { ILike } from "typeorm";

// Escapes LIKE wildcards so the search term matches literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export const findToolsSchema = findToolsParamsSchema.transform(({ search, source, mcpServerId, ...page }) => ({
  ...page,
  where: {
    ...(search ? { name: ILike(`%${escapeLike(search)}%`) } : {}),
    ...(source ? { source } : {}),
    ...(mcpServerId ? { mcpServerId } : {}),
  },
  order: { name: "ASC" as const },
}));
