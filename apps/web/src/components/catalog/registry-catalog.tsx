import { InputSearch } from "@/components/ui/input-search";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useMemo, useState } from "react";

import { CatalogList, CatalogListSkeleton } from "./catalog-list";
import {
  buildRegistryViews,
  filterRegistryViews,
  REGISTRY_SORTS,
  registryStats,
  sortRegistryViews,
} from "./registry-view";

import type { ReactNode } from "react";
import type { RegistryEntry, RegistryFilter, RegistrySort, RegistryView } from "./registry-view";

type RegistryCatalogProps<C> = {
  registry: RegistryEntry[];
  connections: C[];
  /** Registry key a connection points at. */
  keyOf: (connection: C) => string;
  isLoading: boolean;
  isError: boolean;
  /** Refetches after a failed load. */
  onRetry: () => void;
  /** Plural display name of what the registry lists, used mid-sentence, e.g. "plugins" or "LLMs". Also keys the remembered filter. */
  noun: string;
  renderItem: (view: RegistryView<C>) => ReactNode;
};

/** Searchable, sortable grid of registry entries, filterable to the ones that already have connections. */
export function RegistryCatalog<C>({
  registry,
  connections,
  keyOf,
  isLoading,
  isError,
  onRetry,
  noun,
  renderItem,
}: RegistryCatalogProps<C>) {
  // Remembered per catalog: people who only manage what they connected keep landing on "Connected".
  const [filter, setFilter] = useLocalStorage<RegistryFilter>(`registry-filter:${noun}`, "all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RegistrySort>("name-asc");

  const views = useMemo(() => buildRegistryViews(registry, connections, keyOf), [registry, connections, keyOf]);

  const stats = useMemo(() => registryStats(views), [views]);

  const visible = useMemo(
    () => sortRegistryViews(filterRegistryViews(views, filter, search), sort),
    [views, filter, search, sort],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as RegistryFilter)} className="shrink-0">
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            All <span className="text-muted-foreground tabular-nums">{stats.available}</span>
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5">
            Connected <span className="text-muted-foreground tabular-nums">{stats.connected}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <InputSearch
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${noun}…`}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-muted-foreground hidden text-sm sm:inline">Sort</span>
          <Select value={sort} onValueChange={(value) => setSort(value as RegistrySort)}>
            <SelectTrigger className="h-10 w-47.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGISTRY_SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <CatalogListSkeleton size="lg" count={4} />
        ) : isError ? (
          <div className="flex items-center gap-3">
            <p className="text-destructive text-sm">Failed to load {noun}.</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : (
          <CatalogList
            items={visible.map((view) => ({ id: view.key, view }))}
            size="lg"
            containerClassName="h-full"
            emptyMessage={search || filter === "connected" ? `No ${noun} match your filters.` : `No ${noun} available.`}
            renderItem={({ view }) => renderItem(view)}
          />
        )}
      </div>
    </div>
  );
}
