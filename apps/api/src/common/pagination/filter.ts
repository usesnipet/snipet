import type { PaginationParams } from "@snipet/contracts";
import { FindOptionsOrder, FindOptionsWhere } from "typeorm";

// What a module's find schema `.transform()`s the query params into.
export type FilterQuery<T> = PaginationParams & {
  where?: FindOptionsWhere<T>;
  order?: FindOptionsOrder<T>;
};
