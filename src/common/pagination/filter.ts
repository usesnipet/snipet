import { FindOptionsOrder, FindOptionsWhere } from "typeorm";
import z from "zod";

export const MAX_TAKE = 2000;

// Base query-string schema for list endpoints. A module extends it with its
// own fields and `.transform()`s them into `where`/`order` (see FilterQuery).
export const filterSchema = z.object({
  take: z.coerce.number().int().min(1).max(MAX_TAKE).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export type FilterDto = z.infer<typeof filterSchema>;

export type FilterQuery<T> = FilterDto & {
  where?: FindOptionsWhere<T>;
  order?: FindOptionsOrder<T>;
};

export interface Paginated<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}
