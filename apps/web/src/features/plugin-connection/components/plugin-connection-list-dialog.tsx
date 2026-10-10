import { DeleteDialog } from "@/components/confirm-dialog";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDialog } from "@/lib/dialog";
import { Pencil, RefreshCw, Trash } from "lucide-react";

import {
  syncState, useDeletePluginConnection, useListPluginConnections, useSyncPluginConnection
} from "@snipet/client";

import { PluginConnectionFormDialog } from "./plugin-connection-form-dialog";

import type { PluginManifest } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";

type PluginConnectionListDialogProps = DialogInstanceProps<{
  plugin: PluginManifest;
}>;

export function PluginConnectionListDialog({ plugin }: PluginConnectionListDialogProps) {
  // Same query as the catalog page, so this list stays in sync with it.
  const { data } = useListPluginConnections();
  const connections = data?.data.filter((c) => c.pluginKey === plugin.key) ?? [];
  const { openDialog } = useDialog();
  const { mutateAsync: deleteConnection } = useDeletePluginConnection();
  const { mutate: sync, isPending: isSyncing, variables: syncingId } = useSyncPluginConnection();

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{plugin.name} connections</DialogTitle>
        <DialogDescription>{plugin.description || `Connections to ${plugin.name}.`}</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[calc(100vh-250px)]">
        <div className="flex flex-col gap-2">
          {connections.length === 0 ? (
            <p className="text-muted-foreground text-sm">No connections yet.</p>
          ) : null}
          {connections.map((connection) => (
            <div key={connection.id} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium leading-none">{connection.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={connection.enabled ? "default" : "outline"}>
                    {connection.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Sync"
                    disabled={isSyncing && syncingId === connection.id}
                    onClick={() => sync(connection.id)}
                  >
                    <RefreshCw />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Edit"
                    onClick={() => openDialog({
                      component: PluginConnectionFormDialog,
                      props: { plugin, connection },
                    })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    aria-label="Delete"
                    onClick={() => openDialog({
                      component: DeleteDialog,
                      props: {
                        title: "Delete plugin connection?",
                        description: (
                          <>
                            This will permanently delete{" "}
                            <span className="font-medium text-foreground">{connection.name}</span>.
                            This action cannot be undone.
                          </>
                        ),
                        onConfirm: () => deleteConnection(connection.id),
                      },
                    })}
                  >
                    <Trash />
                  </Button>
                </div>
              </div>
              <div className="text-xs">
                <SyncStatus sync={syncState(connection)} />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
        <Button
          type="button"
          onClick={() => openDialog({ component: PluginConnectionFormDialog, props: { plugin } })}
        >
          New connection
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
