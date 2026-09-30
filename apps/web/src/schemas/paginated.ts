import { z } from "zod";

export const paginationParamsSchema = z
  .object({
    take: z.number().min(1).optional(),
    skip: z.number().min(0).optional(),
  })
  .strict();

export type PaginationParams = z.infer<typeof paginationParamsSchema>;

export const paginatedSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    total: z.number(),
    skip: z.number(),
    take: z.number(),
  });

export type Paginated<T> = {
  data: T[];
  total: number;
  skip: number;
  take: number;
};
