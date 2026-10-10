/** What the backend offers to connect to: an LLM provider, a plugin, … */
export type RegistryEntry = {
  key: string;
  name: string;
  description: string;
  icon?: string;
  tags?: string[];
};

/**
 * A registry entry joined with the configured connections that point at it.
 * One registry entry can back many connections.
 */
export type RegistryView<C = unknown> = {
  key: string;
  name: string;
  description: string;
  icon?: string;
  tags: string[];
  /** Configured connections for this registry key. */
  instances: C[];
  /** How many connections reference this registry entry. */
  connectionCount: number;
  /** True when at least one connection is configured for this entry. */
  connected: boolean;
};

export type RegistryFilter = "all" | "connected";

export type RegistrySort =
  | "connected-first"
  | "name-asc"
  | "name-desc"
  | "connections-desc";

export const REGISTRY_SORTS: { value: RegistrySort; label: string }[] = [
  { value: "connected-first", label: "Connected first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "connections-desc", label: "Most connections" },
];

export function buildRegistryViews<C>(
  registry: RegistryEntry[],
  connections: C[],
  keyOf: (connection: C) => string,
): RegistryView<C>[] {
  const byKey = new Map<string, C[]>();
  for (const connection of connections) {
    const key = keyOf(connection);
    byKey.set(key, [...(byKey.get(key) ?? []), connection]);
  }

  return registry.map((entry) => {
    const instances = byKey.get(entry.key) ?? [];
    return {
      key: entry.key,
      name: entry.name,
      description: entry.description,
      icon: entry.icon,
      tags: entry.tags ?? [],
      instances,
      connectionCount: instances.length,
      connected: instances.length > 0,
    };
  });
}

export function filterRegistryViews<V extends RegistryView>(
  views: V[],
  filter: RegistryFilter,
  search: string,
): V[] {
  const query = search.trim().toLowerCase();

  return views.filter((view) => {
    if (filter === "connected" && !view.connected) return false;
    if (!query) return true;
    return (
      view.name.toLowerCase().includes(query) ||
      view.key.toLowerCase().includes(query) ||
      view.description.toLowerCase().includes(query) ||
      view.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });
}

export function sortRegistryViews<V extends RegistryView>(
  views: V[],
  sort: RegistrySort,
): V[] {
  const byName = (a: RegistryView, b: RegistryView) => a.name.localeCompare(b.name);
  const sorted = [...views];

  switch (sort) {
    case "name-asc":
      return sorted.sort(byName);
    case "name-desc":
      return sorted.sort((a, b) => byName(b, a));
    case "connections-desc":
      return sorted.sort(
        (a, b) => b.connectionCount - a.connectionCount || byName(a, b),
      );
    case "connected-first":
    default:
      return sorted.sort(
        (a, b) => Number(b.connected) - Number(a.connected) || byName(a, b),
      );
  }
}

export function registryStats(views: RegistryView[]) {
  return {
    available: views.length,
    connected: views.filter((view) => view.connected).length,
  };
}
