/**
 * The items sorted by key, the last of a duplicate winning: a jsonb column
 * has no unique constraint to reject it.
 */
export function uniqueSortedBy<T>(items: T[], key: (item: T) => string): T[] {
  const byKey = new Map(items.map((item) => [key(item), item]));
  return [...byKey.keys()].sort().map((k) => byKey.get(k)!);
}
