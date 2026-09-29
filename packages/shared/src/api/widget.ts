import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

export const widgetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  spec: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Widget = z.infer<typeof widgetSchema>;

export const paginatedWidgetSchema = paginatedSchema(widgetSchema);

export const createWidgetSchema = z.object({
  name: z.string().min(1).max(255),
  spec: z.record(z.string(), z.unknown()).optional(),
});
export type CreateWidget = z.infer<typeof createWidgetSchema>;

// No .default() in create: .partial() keeps defaults and would overwrite
// columns on update. Let the DB column default handle it.
export const updateWidgetSchema = createWidgetSchema.partial();
export type UpdateWidget = z.infer<typeof updateWidgetSchema>;

export const findWidgetsParamsSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
});
export type FindWidgetsParams = z.infer<typeof findWidgetsParamsSchema>;
