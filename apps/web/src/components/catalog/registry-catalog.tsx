import { LoadingFallback } from "@/components/loading-fallback";
import { InputSearch } from "@/components/ui/input-search";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

import { CatalogList } from "./catalog-list";
import {
  buildRegistryViews, filterRegistryViews, REGISTRY_SORTS, registryStats, sortRegistryViews
} from "./registry-view";

import type { ReactNode } from "react";
import type { RegistryEntry, RegistryFilter, RegistrySort, RegistryView } from "./registry-view";

type StatToggleProps = {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
};

function StatToggle({ active, count, label, onClick }: StatToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40",
      )}
    >
      <span className="text-lg font-semibold tabular-nums">{count}</span>
      <span
        className={cn(
          "text-xs",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

type RegistryCatalogProps<C> = {
  registry: RegistryEntry[];
  connections: C[];
  /** Registry key a connection points at. */
  keyOf: (connection: C) => string;
  isLoading: boolean;
  isError: boolean;
  /** Plural, lowercase name of what the registry lists, e.g. "providers". */
  noun: string;
  renderItem: (view: RegistryView<C>) => ReactNode;
};

// Searchable, sortable grid of registry entries, filterable to the ones that
// already have connections.
export function RegistryCatalog<C>({
  registry, connections, keyOf, isLoading, isError, noun, renderItem,
}: RegistryCatalogProps<C>) {
  const [filter, setFilter] = useState<RegistryFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RegistrySort>("connected-first");

  const views = useMemo(
    () => buildRegistryViews(registry, connections, keyOf),
    [registry, connections, keyOf],
  );

  const stats = useMemo(() => registryStats(views), [views]);

  const visible = useMemo(
    () => sortRegistryViews(filterRegistryViews(views, filter, search), sort),
    [views, filter, search, sort],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 flex-wrap gap-2">
        <StatToggle
          active={filter === "all"}
          count={stats.available}
          label={`Available ${noun}`}
          onClick={() => setFilter("all")}
        />
        <StatToggle
          active={filter === "connected"}
          count={stats.connected}
          label="Connected"
          onClick={() => setFilter("connected")}
        />
      </div>

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
          <LoadingFallback className="min-h-40" />
        ) : isError ? (
          <p className="text-destructive text-sm">Failed to load {noun}.</p>
        ) : (
          <CatalogList
            items={visible.map((view) => ({ id: view.key, view }))}
            size="lg"
            containerClassName="h-full"
            emptyMessage={
              search || filter === "connected"
                ? `No ${noun} match your filters.`
                : `No ${noun} available.`
            }
            renderItem={({ view }) => renderItem(view)}
          />
        )}
      </div>
    </div>
  );
}
