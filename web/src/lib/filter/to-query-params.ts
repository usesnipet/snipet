import type {
  FilterOrderDirection,
  FilterOrderInput,
  FindFilterInput,
} from "./types";

function orderToQueryObject<TEntity extends object>(
  order: FilterOrderInput<TEntity>,
): Record<string, FilterOrderDirection> | undefined {
  const entries = Object.entries(order).filter(
    (entry): entry is [string, FilterOrderDirection] =>
      entry[1] === "asc" || entry[1] === "desc",
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Converts a filter object into query params for Kubb find clients.
 * Serializes as bracket notation (`where[name][like]=...`) via `api-client` + qs.
 */
export function withParams<TEntity extends object>(input: FindFilterInput<TEntity>): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (input.where && Object.keys(input.where).length > 0) {
    params.where = input.where;
  }

  if (input.select?.length) {
    params.select = input.select;
  }

  if (input.relations?.length) {
    params.relations = input.relations;
  }

  if (input.order) {
    const order = orderToQueryObject(input.order);
    if (order) params.order = order;
  }

  if (input.limit !== undefined) params.limit = input.limit;
  if (input.offset !== undefined) params.offset = input.offset;

  return params;
}
