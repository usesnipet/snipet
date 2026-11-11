import { CatalogCard, CatalogList, CatalogListSkeleton } from "@/components/catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputSearch } from "@/components/ui/input-search";
import { useClipboard } from "@/hooks/use-clipboard";
import { useDialog } from "@/lib/dialog";
import { ROUTES } from "@/routes";
import { useDeleteAgent, useListAgents } from "@snipet/client";
import { Copy, MessageSquare, MoreHorizontal, Pencil, Plug, Plus, Server, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { agentChatPath, agentPath } from "../lib/agent-path";

import { AgentAvatar } from "./agent-avatar";

import type { AgentSummary } from "@snipet/shared";

export function AgentCatalog() {
  // ponytail: first 500 only, paginate if anyone gets near that.
  const agentsQuery = useListAgents({ searchParams: { take: 500 } });
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  if (agentsQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {/* Same toolbar slot as the loaded view, so the grid doesn't shift when the search box appears. */}
        <Skeleton className="h-10 w-full shrink-0 sm:ml-auto sm:w-72" />
        <CatalogListSkeleton size="md" />
      </div>
    );
  }
  if (agentsQuery.isError) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-destructive text-sm">Failed to load agents.</p>
        <Button
          variant="outline"
          size="sm"
          disabled={agentsQuery.isFetching}
          onClick={() => void agentsQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const allAgents = agentsQuery.data?.data ?? [];
  if (allAgents.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24 text-center">
        <div>
          <p className="font-medium">No agents yet</p>
          <p className="text-muted-foreground text-sm">
            Create one to choose its models and plugins, then chat with it.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(ROUTES.agentNew)}>
          <Plus />
          New agent
        </Button>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const agents = allAgents.filter((agent) => !query || agent.name.toLowerCase().includes(query));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="shrink-0 sm:flex sm:justify-end">
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
          emptyMessage="No agents match your search."
          renderItem={(agent) => <AgentCard agent={agent} />}
        />
      </div>
    </div>
  );
}

/** What the agent is made of: its main model, how many fall back behind it, and its plugins. */
function AgentComposition({ agent }: { agent: AgentSummary }) {
  const [mainModel, ...fallbacks] = agent.llms.map((llm) => llm.model);
  const pluginNames = agent.pluginConnections.map((grant) => grant.name).join(", ");

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5" title={[mainModel, ...fallbacks].join(", ")}>
        <Server className="size-3.5 shrink-0" aria-label="Models" />
        <span className="truncate">{mainModel}</span>
        {fallbacks.length > 0 && <span className="shrink-0">+{fallbacks.length}</span>}
      </span>
      <span className="flex items-center gap-1.5" title={pluginNames || undefined}>
        <Plug className="size-3.5 shrink-0" aria-label="Plugins" />
        <span className="truncate">{pluginNames || "No plugins"}</span>
      </span>
    </span>
  );
}

function AgentCard({ agent }: { agent: AgentSummary }) {
  const navigate = useNavigate();
  const { openDialog } = useDialog();
  const { copy } = useClipboard();
  const { mutateAsync: deleteAgent } = useDeleteAgent();

  const openEdit = () => navigate(agentPath(agent.id));

  const openDelete = () =>
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete agent?",
        description: (
          <>
            <span className="font-medium text-foreground">{agent.name}</span> and all of its chats will be deleted. This
            action cannot be undone.
          </>
        ),
        onConfirm: () => deleteAgent(agent.id),
      },
    });

  return (
    <CatalogCard
      className={agent.enabled ? undefined : "border-dashed bg-transparent shadow-none"}
      icon={
        <AgentAvatar
          avatar={agent.avatar}
          name={agent.name}
          className={agent.enabled ? undefined : "opacity-50 grayscale"}
        />
      }
      title={agent.name}
      description={agent.description || "No description"}
      tags={agent.enabled ? undefined : ["Disabled"]}
      meta={<AgentComposition agent={agent} />}
      cta={
        agent.enabled
          ? { label: "Chat", icon: <MessageSquare />, onClick: () => navigate(agentChatPath(agent.id)) }
          : undefined
      }
      onClick={openEdit}
      headerActions={
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
            <DropdownMenuItem
              onClick={() => copy(agent.id, { successTitle: "Agent ID copied", errorTitle: "Failed to copy agent ID" })}
            >
              <Copy />
              Copy agent ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={openDelete}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
