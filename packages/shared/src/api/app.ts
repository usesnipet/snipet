import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// Bare origin ("https://app.example.com"): matched exactly against the Origin header.
const originSchema = z
  .string()
  .refine((s) => URL.canParse(s) && new URL(s).origin === s, "must be an origin like https://app.example.com");

export const appSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  allowedOrigins: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type App = z.infer<typeof appSchema>;

export const paginatedAppSchema = paginatedSchema(appSchema);

export const createAppSchema = z.object({
  name: z.string().min(1).max(255),
  allowedOrigins: z.array(originSchema).optional(),
});
export type CreateApp = z.infer<typeof createAppSchema>;

export const updateAppSchema = createAppSchema.partial();
export type UpdateApp = z.infer<typeof updateAppSchema>;

export const findAppsParamsSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
});
export type FindAppsParams = z.infer<typeof findAppsParamsSchema>;
