export type FilterOrderDirection = "asc" | "desc";

export type FilterWhereOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "contains";

export type FilterPrimitive = string | number | boolean | null;

/** Bracket style: `{ like: "%x%" }`. */
export type WhereFieldCondition =
  | FilterPrimitive
  | Partial<Record<FilterWhereOp, FilterPrimitive | FilterPrimitive[]>>;

export type FilterWhere<TEntity extends object> = Partial<
  Record<keyof TEntity & string, WhereFieldCondition>
>;

export type FilterSelect<TEntity extends object> = Array<keyof TEntity & string>;

/** `order: { name: "desc" }`. */
export type FilterOrderInput<T extends object> = Partial<Record<keyof T & string, FilterOrderDirection>>;

export type FindFilterInput<TEntity extends object> = {
  where?: FilterWhere<TEntity>;
  select?: FilterSelect<TEntity>;
  order?: FilterOrderInput<TEntity>;
  relations?: string[];
  limit?: number;
  offset?: number;
};
