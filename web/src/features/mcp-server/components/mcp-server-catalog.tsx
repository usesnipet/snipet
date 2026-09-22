import { CatalogList } from "@/components/catalog";
import { LoadingFallback } from "@/components/loading-fallback";
import { Button } from "@/components/ui/button";
import { InputSearch } from "@/components/ui/input-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListTools } from "@/features/tool/hooks";
import { useDialog } from "@/lib/dialog";
import { cn } from "@/lib/utils";
import { Blocks, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useListMcpServers, useMcpServerRegistry } from "../hooks";
import { describeConfig, matchRegistryItem } from "../lib/config";

import { InstalledMcpServerCard } from "./installed-mcp-server-card";
import { McpServerFormDialog } from "./mcp-server-form-dialog";
import { RegistryMcpServerCard } from "./registry-mcp-server-card";

import type { Tool } from "@/models/tool";

type Tab = "installed" | "discover";

// Tools aren't filterable by server on the API yet, so load them in one page and group client-side.
const TOOLS_PAGE_SIZE = 1000;

function matches(query: string, ...fields: (string | undefined)[]) {
  return fields.some((field) => field?.toLowerCase().includes(query));
}

export function McpServerCatalog() {
  const { openDialog } = useDialog();
  const serversQuery = useListMcpServers({ searchParams: { take: 500 } });
  const registryQuery = useMcpServerRegistry();
  const toolsQuery = useListTools({ searchParams: { take: TOOLS_PAGE_SIZE } });

  const [tab, setTab] = useState<Tab | null>(null);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const servers = useMemo(() => serversQuery.data?.data ?? [], [serversQuery.data]);
  const registry = useMemo(() => registryQuery.data ?? [], [registryQuery.data]);

  const installed = useMemo(
    () => servers.map((server) => ({ server, registryItem: matchRegistryItem(server, registry) })),
    [servers, registry],
  );

  const toolsByServer = useMemo(() => {
    const map = new Map<string, Tool[]>();
    for (const tool of toolsQuery.data?.data ?? []) {
      if (!tool.mcp_server_id) continue;
      map.set(tool.mcp_server_id, [...(map.get(tool.mcp_server_id) ?? []), tool]);
    }
    return map;
  }, [toolsQuery.data]);

  const installedCountByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const { registryItem } of installed) {
      if (registryItem) map.set(registryItem.key, (map.get(registryItem.key) ?? 0) + 1);
    }
    return map;
  }, [installed]);

  const tags = useMemo(() => [...new Set(registry.flatMap((item) => item.tags))].sort(), [registry]);

  const query = search.trim().toLowerCase();
  const visibleInstalled = installed.filter(({ server }) =>
    !query || matches(query, server.name, describeConfig(server)));
  const visibleRegistry = registry.filter((item) =>
    (!tag || item.tags.includes(tag)) &&
    (!query || matches(query, item.name, item.key, item.description, ...item.tags)));

  const openCustom = () => openDialog({ component: McpServerFormDialog, props: {} });

  if (serversQuery.isLoading || registryQuery.isLoading) {
    return <LoadingFallback className="min-h-40" />;
  }
  if (serversQuery.isError || registryQuery.isError) {
    return <p className="text-destructive text-sm">Failed to load MCP servers.</p>;
  }

  // Land on Discover until something is installed.
  const activeTab: Tab = tab ?? (servers.length ? "installed" : "discover");

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setTab(value as Tab)}
      className="flex min-h-0 flex-1 flex-col gap-5"
    >
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <TabsList>
          <TabsTrigger value="installed" className="gap-2">
            Installed
            <span className="text-muted-foreground tabular-nums">{servers.length}</span>
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2">
            Discover
            <span className="text-muted-foreground tabular-nums">{registry.length}</span>
          </TabsTrigger>
        </TabsList>
        <div className="sm:ml-auto sm:w-72">
          <InputSearch
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={activeTab === "installed" ? "Search installed servers…" : "Search the registry…"}
            className="w-full"
          />
        </div>
      </div>

      <TabsContent value="installed" className="mt-0 min-h-0 flex-1">
        {servers.length === 0 ? (
          <EmptyInstalled onBrowse={() => setTab("discover")} onCustom={openCustom} />
        ) : (
          <CatalogList
            items={visibleInstalled.map((entry) => ({ id: entry.server.id, ...entry }))}
            size="md"
            containerClassName="h-full"
            emptyMessage="No installed servers match your search."
            renderItem={({ server, registryItem }) => (
              <InstalledMcpServerCard
                server={server}
                registryItem={registryItem}
                tools={toolsByServer.get(server.id) ?? []}
              />
            )}
          />
        )}
      </TabsContent>

      <TabsContent value="discover" className="mt-0 flex min-h-0 flex-1 flex-col gap-4">
        {tags.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <TagChip active={!tag} onClick={() => setTag(null)}>All</TagChip>
            {tags.map((item) => (
              <TagChip key={item} active={tag === item} onClick={() => setTag(tag === item ? null : item)}>
                {item}
              </TagChip>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <CatalogList
            items={visibleRegistry.map((item) => ({ id: item.key, item }))}
            size="md"
            containerClassName="h-full"
            emptyMessage="Nothing in the registry matches. You can still add any server as a custom one."
            renderItem={({ item }) => (
              <RegistryMcpServerCard item={item} installedCount={installedCountByKey.get(item.key) ?? 0} />
            )}
          />
        </div>
        <button
          type="button"
          onClick={openCustom}
          className="text-muted-foreground hover:border-primary/40 hover:text-foreground flex shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm transition-colors"
        >
          <Plus className="size-4" />
          Don't see yours? Add a custom MCP server
        </button>
      </TabsContent>
    </Tabs>
  );
}

function TagChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

function EmptyInstalled({ onBrowse, onCustom }: { onBrowse: () => void; onCustom: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <Blocks className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <p className="text-sm font-medium">No MCP servers yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Install one from the registry in a couple of clicks, or connect any server you already run.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onBrowse}>Browse registry</Button>
        <Button variant="outline" onClick={onCustom}>Add custom server</Button>
      </div>
    </div>
  );
}
