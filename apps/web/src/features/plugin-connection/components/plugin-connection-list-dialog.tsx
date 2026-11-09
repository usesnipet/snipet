import { DeleteDialog } from "@/components/confirm-dialog";
import { ConnectionListBody } from "@/components/connection-list-body";
import { IconAction } from "@/components/icon-action";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDialog } from "@/lib/dialog";
import { cn } from "@/lib/utils";
import { ChevronRight, MoreHorizontal, Pencil, Power, PowerOff, RefreshCw, Trash2 } from "lucide-react";

import {
  syncState,
  useDeletePluginConnection,
  useListAgents,
  useListPluginConnections,
  usePluginConnectionTools,
  useSyncPluginConnection,
  useUpdatePluginConnection,
} from "@snipet/client";
import { hookHandlersOf } from "@snipet/shared";

import { PluginConnectionFormDialog } from "./dialogs";

import type { PluginConnection, PluginManifest } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";

type PluginConnectionListDialogProps = DialogInstanceProps<{
  plugin: PluginManifest;
}>;

export function PluginConnectionListDialog({ plugin }: PluginConnectionListDialogProps) {
  // Same query as the catalog page, so this list stays in sync with it.
  const connectionsQuery = useListPluginConnections();
  const { openDialog } = useDialog();
  const connections = connectionsQuery.data?.data.filter((c) => c.pluginKey === plugin.key) ?? [];
  const isEmpty = connectionsQuery.isSuccess && connections.length === 0;

  const addNewConnection = () => openDialog({ component: PluginConnectionFormDialog, props: { plugin } });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{plugin.name} connections</DialogTitle>
        <DialogDescription>Agents choose which of these connections they can use.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-2">
        <ConnectionListBody query={connectionsQuery} isEmpty={isEmpty} name={plugin.name} onAdd={addNewConnection}>
          {connections.map((connection) => (
            <PluginConnectionRow key={connection.id} plugin={plugin} connection={connection} />
          ))}
        </ConnectionListBody>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
        {!isEmpty && (
          <Button type="button" onClick={addNewConnection}>
            New connection
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

/** What syncing does for this plugin: fetch its tools or instructions, or only run the health check. */
function syncLabel({ capabilities }: PluginManifest): string {
  if (capabilities.tools) return "Sync tools";
  if (capabilities.instructions) return "Sync instructions";
  return "Check connection";
}

/** One connection with its sync state and actions; Sync stays visible, the rest live in the menu. */
function PluginConnectionRow({ plugin, connection }: { plugin: PluginManifest; connection: PluginConnection }) {
  const { openDialog } = useDialog();
  const { mutateAsync: deleteConnection } = useDeletePluginConnection();
  const { mutate: updateConnection } = useUpdatePluginConnection();
  const { mutate: sync, isPending: isSyncing } = useSyncPluginConnection();
  const syncStatus = syncState(connection);
  const hasTools = !!plugin.capabilities.tools;
  const { data: tools } = usePluginConnectionTools(connection, { enabled: hasTools && syncStatus.kind === "synced" });
  const hookCount = plugin.capabilities.hooks ? hookHandlersOf(plugin.capabilities.hooks).size : 0;

  const openEdit = () => openDialog({ component: PluginConnectionFormDialog, props: { plugin, connection } });
  const openDelete = () =>
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete plugin connection?",
        description: (
          <>
            This will permanently delete <span className="font-medium text-foreground">{connection.name}</span>.{" "}
            <AgentUsage connectionId={connection.id} /> This action cannot be undone.
          </>
        ),
        onConfirm: () => deleteConnection(connection.id),
      },
    });

  return (
    <Collapsible className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium leading-none">{connection.name}</span>
          {!connection.enabled && <Badge variant="outline">Disabled</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction tooltip={syncLabel(plugin)}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${syncLabel(plugin)} of ${connection.name}`}
              disabled={isSyncing}
              onClick={() => sync(connection.id)}
            >
              <RefreshCw className={cn(isSyncing && "animate-spin")} />
            </Button>
          </IconAction>
          <DropdownMenu>
            <IconAction tooltip="More actions">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${connection.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </IconAction>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateConnection({ id: connection.id, data: { enabled: !connection.enabled } })}
              >
                {connection.enabled ? <PowerOff /> : <Power />}
                {connection.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={openDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <SyncStatus sync={syncStatus} />
          {tools && (
            <CollapsibleTrigger
              disabled={!tools.length}
              className="text-muted-foreground group flex shrink-0 items-center gap-0.5 hover:text-foreground disabled:hover:text-muted-foreground"
            >
              · {tools.length} {tools.length === 1 ? "tool" : "tools"}
              {tools.length > 0 && (
                <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
              )}
            </CollapsibleTrigger>
          )}
          {hookCount > 0 && (
            <span className="text-muted-foreground shrink-0">
              · {hookCount} {hookCount === 1 ? "hook" : "hooks"}
            </span>
          )}
        </div>
        {syncStatus.kind === "error" && (
          <Button variant="link" size="xs" className="h-auto shrink-0 p-0" onClick={openEdit}>
            Edit
          </Button>
        )}
      </div>
      {tools && tools.length > 0 && (
        <CollapsibleContent>
          <ul className="flex flex-col gap-1.5 border-t pt-2 text-xs">
            {tools.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                {tool.description && <p className="text-muted-foreground line-clamp-2">{tool.description}</p>}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/**
 * How many agents lose the connection when it's deleted (the API cascades).
 * Same query as the agent catalog, so it's usually cached.
 */
function AgentUsage({ connectionId }: { connectionId: string }) {
  // ponytail: counts the first 500 agents only, add a usage endpoint if workspaces outgrow that.
  const { data } = useListAgents({ searchParams: { take: 500 } });
  const count = data?.data.filter((agent) =>
    agent.pluginConnections.some((link) => link.pluginConnectionId === connectionId),
  ).length;
  if (!count) return null;
  return (
    <>
      Used by {count} {count === 1 ? "agent" : "agents"}, which lose its tools and hooks.
    </>
  );
}
