import { findWidgetsParamsSchema } from "@snipet/contracts";
import { ILike } from "typeorm";

export { createWidgetSchema, updateWidgetSchema } from "@snipet/contracts";

// Shared params -> TypeORM where/order. Backend only.
export const findWidgetsSchema = findWidgetsParamsSchema.transform(({ name, ...page }) => ({
  ...page,
  where: name ? { name: ILike(`%${name}%`) } : undefined,
  order: { createdAt: "DESC" as const },
}));
