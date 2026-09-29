import { z } from "zod";

export const MAX_TAKE = 2000;

// Query params accepted by every list endpoint. Module params `.extend()` it.
export const paginationParamsSchema = z.object({
  take: z.coerce.number().int().min(1).max(MAX_TAKE).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export type PaginationParams = z.infer<typeof paginationParamsSchema>;

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number(),
    skip: z.number(),
    take: z.number(),
  });

export interface Paginated<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}
