import type { LlmProvider, LlmProviderRegistryEntry } from "../schemas";

/**
 * A registry entry (the provider driver available on the backend) joined with
 * the configured {@link LlmProvider} instances that point at it. One registry
 * entry can back many llm providers.
 */
export type RegistryView = {
  key: string;
  name: string;
  description: string;
  icon?: string;
  tags: string[];
  /** Configured llm provider instances for this registry key. */
  instances: LlmProvider[];
  /** How many llm providers reference this registry entry. */
  providerCount: number;
  /** True when at least one llm provider is configured for this entry. */
  connected: boolean;
};

export type RegistryFilter = "all" | "connected";

export type RegistrySort =
  | "connected-first"
  | "name-asc"
  | "name-desc"
  | "providers-desc";

export const REGISTRY_SORTS: { value: RegistrySort; label: string }[] = [
  { value: "connected-first", label: "Connected first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "providers-desc", label: "Most providers" },
];

export function buildRegistryViews(
  registry: LlmProviderRegistryEntry[],
  providers: LlmProvider[],
): RegistryView[] {
  const byKey = new Map<string, LlmProvider[]>();
  for (const provider of providers) {
    const list = byKey.get(provider.provider) ?? [];
    list.push(provider);
    byKey.set(provider.provider, list);
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
      providerCount: instances.length,
      connected: instances.length > 0,
    };
  });
}

export function filterRegistryViews(
  views: RegistryView[],
  filter: RegistryFilter,
  search: string,
): RegistryView[] {
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

export function sortRegistryViews(
  views: RegistryView[],
  sort: RegistrySort,
): RegistryView[] {
  const byName = (a: RegistryView, b: RegistryView) => a.name.localeCompare(b.name);
  const sorted = [...views];

  switch (sort) {
    case "name-asc":
      return sorted.sort(byName);
    case "name-desc":
      return sorted.sort((a, b) => byName(b, a));
    case "providers-desc":
      return sorted.sort(
        (a, b) => b.providerCount - a.providerCount || byName(a, b),
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
