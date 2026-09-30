import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputSearch } from "@/components/ui/input-search";
import { Link } from "@/components/ui/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListMcpServers, useMcpServerRegistry } from "@/features/mcp-server/hooks";
import { matchRegistryItem } from "@/features/mcp-server/lib/config";
import { useDebouncedState } from "@/hooks/use-debounced-state";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ChevronRight, SearchX, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useListTools } from "../hooks";

import { ToolCard } from "./tool-card";
import { ToolDetailsSheet } from "./tool-details-sheet";
import { ToolIcon } from "./tool-icon";

import type { Tool, ToolSource } from "../schemas";
const ALL = "all";
// ponytail: loads every tool in one request to group them; paginate per group if this is ever outgrown.
const MAX_TOOLS = 1000;

type ToolGroup = { key: string; name: string; icon?: string; tools: Tool[] };

export function ToolBrowser() {
  const [params, setParams] = useSearchParams();
  const source = (params.get("source") as ToolSource | null) ?? undefined;
  const serverId = params.get("server") ?? undefined;
  const query = params.get("q") ?? "";

  const [selected, setSelected] = useState<Tool | null>(null);

  const update = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: true });

  const [search, setSearch] = useDebouncedState(query, 300, (value) => update({ q: value.trim() }));

  const toolsQuery = useListTools({
    searchParams: {
      take: MAX_TOOLS,
      search: query || undefined,
      source,
      mcp_server_id: serverId,
    },
  });

  const serversQuery = useListMcpServers({ searchParams: { take: 500 } });
  const registryQuery = useMcpServerRegistry();

  const servers = serversQuery.data?.data ?? [];
  const tools = toolsQuery.data?.data ?? [];
  const hasFilters = !!(query || source || serverId);

  const iconByServer = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const server of serversQuery.data?.data ?? []) {
      map.set(server.id, matchRegistryItem(server, registryQuery.data ?? [])?.icon);
    }
    return map;
  }, [serversQuery.data, registryQuery.data]);
  const iconFor = (tool: Tool | null) => (tool?.mcp_server_id ? iconByServer.get(tool.mcp_server_id) : undefined);

  // Built-in tools first, then one group per MCP server by name.
  const groups = useMemo(() => {
    const byKey = new Map<string, ToolGroup>();
    for (const tool of toolsQuery.data?.data ?? []) {
      const key = tool.mcp_server_id ?? "native";
      const group = byKey.get(key) ?? {
        key,
        name: tool.mcp_server?.name ?? "Built-in",
        icon: tool.mcp_server_id ? iconByServer.get(tool.mcp_server_id) : undefined,
        tools: [],
      };
      group.tools.push(tool);
      byKey.set(key, group);
    }
    return Array.from(byKey.values()).sort((a, b) =>
      Number(b.key === "native") - Number(a.key === "native") || a.name.localeCompare(b.name));
  }, [toolsQuery.data, iconByServer]);

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
        <ToolGridSkeleton count={9} />
      ) : toolsQuery.isError ? (
        <p className="text-destructive text-sm">Failed to load tools.</p>
      ) : tools.length === 0 ? (
        hasFilters ? <EmptyFiltered onClear={clearFilters} /> : <EmptyTools />
      ) : (
        <div className={cn("space-y-3 transition-opacity", toolsQuery.isPlaceholderData && "opacity-60")}>
          {groups.map((group) => (
            <Collapsible key={group.key} defaultOpen className="rounded-xl border">
              <CollapsibleTrigger className="group hover:bg-muted/40 flex w-full items-center gap-3 rounded-xl p-3 text-left">
                <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                <ToolIcon tool={group.tools[0]} serverIcon={group.icon} className="size-7" />
                <span className="truncate text-sm font-semibold">{group.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{group.tools.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="*:data-radix-scroll-area-viewport:max-h-96">
                  <ul className="grid gap-3 border-t p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.tools.map((tool) => (
                      <li key={tool.id}>
                        <ToolCard tool={tool} serverIcon={iconFor(tool)} onSelect={setSelected} />
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
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
