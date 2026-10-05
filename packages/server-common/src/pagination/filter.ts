import type { PaginationParams } from "@snipet/shared";
import { FindOptionsOrder, FindOptionsRelations, FindOptionsWhere } from "typeorm";

// What a module's find schema `.transform()`s the query params into.
export type FilterQuery<T> = PaginationParams & {
  where?: FindOptionsWhere<T>;
  order?: FindOptionsOrder<T>;
  relations?: FindOptionsRelations<T>;
};
