import { CatalogCard, CatalogList } from "@/components/catalog";
import { DeleteDialog } from "@/components/confirm-dialog";
import { LoadingFallback } from "@/components/loading-fallback";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { InputSearch } from "@/components/ui/input-search";
import { useClipboard } from "@/hooks/use-clipboard";
import { useDialog } from "@/lib/dialog";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { useDeleteAgent, useListAgents } from "@snipet/client";

import { AgentAvatar } from "./agent-avatar";
import { AgentFormDialog } from "./agent-form-dialog";

import type { Agent } from "@snipet/shared";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function AgentCatalog() {
  // ponytail: first 500 only, paginate if anyone gets near that.
  const agentsQuery = useListAgents({ searchParams: { take: 500 } });
  const [search, setSearch] = useState("");

  if (agentsQuery.isLoading) return <LoadingFallback className="min-h-40" />;
  if (agentsQuery.isError) return <p className="text-destructive text-sm">Failed to load agents.</p>;

  const query = search.trim().toLowerCase();
  const agents = (agentsQuery.data?.data ?? []).filter((agent) => !query || agent.name.toLowerCase().includes(query));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 sm:justify-end">
        <InputSearch
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search agents…"
          className="w-full sm:w-72"
        />
      </div>
      <div className="min-h-0 flex-1">
        <CatalogList
          items={agents}
          size="md"
          containerClassName="h-full"
          emptyMessage={query ? "No agents match your search." : "No agents yet."}
          renderItem={(agent) => <AgentCard agent={agent} />}
        />
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const { openDialog } = useDialog();
  const { copy } = useClipboard();
  const { mutateAsync: deleteAgent } = useDeleteAgent();

  const openEdit = () => openDialog({ component: AgentFormDialog, props: { agent } });

  const openDelete = () => openDialog({
    component: DeleteDialog,
    props: {
      title: "Delete agent?",
      description: (
        <>
          <span className="font-medium text-foreground">{agent.name}</span> and all of its sessions will be
          deleted. This action cannot be undone.
        </>
      ),
      onConfirm: () => deleteAgent(agent.id),
    },
  });

  return (
    <CatalogCard
      icon={<AgentAvatar avatar={agent.avatar} />}
      title={agent.name}
      description={agent.description}
      tags={agent.enabled ? undefined : ["Disabled"]}
      updatedAt={agent.updatedAt.toISOString()}
      meta={`${plural(agent.llms.length, "model")} · ${plural(agent.pluginConnections.length, "plugin")}`}
      onClick={openEdit}
      headerActions={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy agent ID"
            title="Copy agent ID"
            onClick={() => copy(agent.id, { successTitle: "Agent ID copied", errorTitle: "Failed to copy agent ID" })}
          >
            <Copy />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={openDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
