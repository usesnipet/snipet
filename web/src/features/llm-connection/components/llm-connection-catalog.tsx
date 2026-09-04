import { CatalogList } from "@/components/catalog";
import { LoadingFallback } from "@/components/loading-fallback";
import { InputSearch } from "@/components/ui/input-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

import { useListLlmConnections, useLlmProviders } from "../hooks";
import {
  buildRegistryViews,
  filterRegistryViews,
  REGISTRY_SORTS,
  registryStats,
  sortRegistryViews,
} from "../lib/registry-view";

import { LlmConnectionCatalogCard } from "./llm-connection-catalog-card";

import type { RegistryFilter, RegistrySort } from "../lib/registry-view";

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

export function LlmConnectionCatalog() {
  const registryQuery = useLlmProviders();
  const connectionsQuery = useListLlmConnections();

  const [filter, setFilter] = useState<RegistryFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RegistrySort>("connected-first");

  const views = useMemo(
    () =>
      buildRegistryViews(
        registryQuery.data ?? [],
        connectionsQuery.data?.data ?? [],
      ),
    [registryQuery.data, connectionsQuery.data],
  );

  const stats = useMemo(() => registryStats(views), [views]);

  const visible = useMemo(
    () => sortRegistryViews(filterRegistryViews(views, filter, search), sort),
    [views, filter, search, sort],
  );

  const isLoading = registryQuery.isLoading || connectionsQuery.isLoading;
  const isError = registryQuery.isError || connectionsQuery.isError;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <StatToggle
          active={filter === "all"}
          count={stats.available}
          label="Available providers"
          onClick={() => setFilter("all")}
        />
        <StatToggle
          active={filter === "connected"}
          count={stats.connected}
          label="Connected"
          onClick={() => setFilter("connected")}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <InputSearch
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers…"
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-muted-foreground hidden text-sm sm:inline">Sort</span>
          <Select value={sort} onValueChange={(value) => setSort(value as RegistrySort)}>
            <SelectTrigger className="h-10 w-[190px]">
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

      {isLoading ? (
        <LoadingFallback className="min-h-40" />
      ) : isError ? (
        <p className="text-destructive text-sm">Failed to load providers.</p>
      ) : (
        <CatalogList
          items={visible.map((view) => ({ id: view.key, view }))}
          size="lg"
          emptyMessage={
            search || filter === "connected"
              ? "No providers match your filters."
              : "No providers available."
          }
          renderItem={({ view }) => <LlmConnectionCatalogCard view={view} />}
        />
      )}
    </div>
  );
}
