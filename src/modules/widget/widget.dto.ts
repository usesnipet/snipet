import { ILike } from "typeorm";
import z from "zod";

import { filterSchema } from "../../common/pagination/filter";

export const createWidgetSchema = z.object({
  name: z.string().min(1).max(255),
  spec: z.record(z.string(), z.unknown()).optional(),
});

// No .default() in create: .partial() keeps defaults and would overwrite
// columns on update. Let the DB column default handle it.
export const updateWidgetSchema = createWidgetSchema.partial();

export const findWidgetsSchema = filterSchema
  .extend({ name: z.string().optional() })
  .transform(({ name, ...page }) => ({
    ...page,
    where: name ? { name: ILike(`%${name}%`) } : undefined,
    order: { createdAt: "DESC" as const },
  }));

export type CreateWidgetDto = z.infer<typeof createWidgetSchema>;
export type UpdateWidgetDto = z.infer<typeof updateWidgetSchema>;
