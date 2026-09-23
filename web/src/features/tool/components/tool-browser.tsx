import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { InputSearch } from "@/components/ui/input-search";
import { Link } from "@/components/ui/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListMcpServers, useMcpServerRegistry } from "@/features/mcp-server/hooks";
import { matchRegistryItem } from "@/features/mcp-server/lib/config";
import { useDebouncedState } from "@/hooks/use-debounced-state";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { SearchX, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useListTools } from "../hooks";

import { ToolCard } from "./tool-card";
import { ToolDetailsSheet } from "./tool-details-sheet";

import type { Tool, ToolSource } from "../schemas";

const PAGE_SIZES = [12, 24, 48];
const DEFAULT_PAGE_SIZE = 24;
const ALL = "all";

export function ToolBrowser() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(params.get("size"))) ? Number(params.get("size")) : DEFAULT_PAGE_SIZE;
  const source = (params.get("source") as ToolSource | null) ?? undefined;
  const serverId = params.get("server") ?? undefined;
  const query = params.get("q") ?? "";

  const [selected, setSelected] = useState<Tool | null>(null);

  // Patches the URL state; any filter change sends the user back to page 1.
  const update = (patch: Record<string, string | number | undefined>, resetPage = true) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (resetPage) next.delete("page");
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: true });

  const [search, setSearch] = useDebouncedState(query, 300, (value) => update({ q: value.trim() }));

  const toolsQuery = useListTools({
    searchParams: {
      take: pageSize,
      skip: (page - 1) * pageSize,
      search: query || undefined,
      source,
      mcp_server_id: serverId,
    },
  });

  const serversQuery = useListMcpServers({ searchParams: { take: 500 } });
  const registryQuery = useMcpServerRegistry();

  const servers = serversQuery.data?.data ?? [];
  const tools = toolsQuery.data?.data ?? [];
  const total = toolsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(query || source || serverId);

  // Keep the page in range when the result set shrinks under it.
  useEffect(() => {
    if (toolsQuery.data && page > pageCount) update({ page: pageCount }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsQuery.data, page, pageCount]);

  const iconByServer = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const server of serversQuery.data?.data ?? []) {
      map.set(server.id, matchRegistryItem(server, registryQuery.data ?? [])?.icon);
    }
    return map;
  }, [serversQuery.data, registryQuery.data]);
  const iconFor = (tool: Tool | null) => (tool?.mcp_server_id ? iconByServer.get(tool.mcp_server_id) : undefined);

  const clearFilters = () => {
    setSearch("");
    update({ q: undefined, source: undefined, server: undefined });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Tabs value={source ?? ALL} onValueChange={(value) => update({ source: value === ALL ? undefined : value })}>
          <TabsList>
            <TabsTrigger value={ALL}>All</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
            <TabsTrigger value="native">Built-in</TabsTrigger>
          </TabsList>
        </Tabs>
        {servers.length > 0 && source !== "native" && (
          <Select value={serverId ?? ALL} onValueChange={(value) => update({ server: value === ALL ? undefined : value })}>
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All servers</SelectItem>
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="sm:ml-auto sm:w-72">
          <InputSearch
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools by name…"
            className="w-full"
          />
        </div>
      </div>

      {toolsQuery.isLoading ? (
        <ToolGridSkeleton count={Math.min(pageSize, 9)} />
      ) : toolsQuery.isError ? (
        <p className="text-destructive text-sm">Failed to load tools.</p>
      ) : tools.length === 0 ? (
        hasFilters ? <EmptyFiltered onClear={clearFilters} /> : <EmptyTools />
      ) : (
        <>
          <ul
            className={cn(
              "grid gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
              toolsQuery.isPlaceholderData && "opacity-60",
            )}
          >
            {tools.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} serverIcon={iconFor(tool)} onSelect={setSelected} />
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemLabel={total === 1 ? "tool" : "tools"}
            onPageChange={(next) => update({ page: next }, false)}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(size) => update({ size })}
            className="border-t pt-4"
          />
        </>
      )}

      <ToolDetailsSheet
        tool={selected}
        serverIcon={iconFor(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function ToolGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
          <div className="flex gap-1 border-t pt-3">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTools() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <Wrench className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <p className="text-sm font-medium">No tools yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Tools show up here once an MCP server is installed and synced.
        </p>
      </div>
      <Button asChild>
        <Link href={ROUTES.mcpServers}>Browse MCP servers</Link>
      </Button>
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <SearchX className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <p className="text-sm font-medium">No tools match your filters</p>
        <p className="text-muted-foreground text-sm">Try a different name or clear the filters.</p>
      </div>
      <Button variant="outline" onClick={onClear}>Clear filters</Button>
    </div>
  );
}
