import { findAppsParamsSchema } from "@snipet/shared";
import { ILike } from "typeorm";

export { createAppSchema, updateAppSchema } from "@snipet/shared";

export const findAppsSchema = findAppsParamsSchema.transform(({ name, ...page }) => ({
  ...page,
  where: name ? { name: ILike(`%${name}%`) } : undefined,
  order: { createdAt: "DESC" as const },
}));
