import { DeleteDialog } from "@/components/confirm-dialog";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDialog } from "@/lib/dialog";
import { cn } from "@/lib/utils";
import { Pencil, RefreshCw, Trash } from "lucide-react";
import { useMemo } from "react";

import { syncState, useDeleteLlmConnection, useListLlmConnections, useSyncLlmConnection } from "@snipet/client";

import { CreateLlmConnectionDialog } from "./create-llm-connection-dialog";

import type { LlmConnection } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";
type LlmConnectionListDialogProps = DialogInstanceProps<{
  llm: { name: string; key: string; };
}>;

export function LlmConnectionListDialog(
  { llm: { key, name } }: LlmConnectionListDialogProps
) {
  const { data: connections, isLoading, error } = useListLlmConnections();
  const { openDialog } = useDialog();
  const { mutateAsync: deleteConnection } = useDeleteLlmConnection();
  const { mutate: sync, isPending: isSyncing, variables: syncingId } = useSyncLlmConnection();

  const connectionsFromLlm = useMemo<LlmConnection[]>(() => {
    if (isLoading || error) return [];
    return connections?.data.filter((connection) => connection.llmKey === key) ?? [];
  }, [connections, key, isLoading, error]);

  const addNewConnection = () => {
    openDialog({
      component: CreateLlmConnectionDialog,
      props: { defaultValues: { llmKey: key } }
    })
  }

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Connections from {name}</DialogTitle>
        <DialogDescription>
          List of connections from {name}
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[calc(100vh-250px)]">
        <div className="flex flex-col gap-2">
          {connectionsFromLlm.map((connection) => (
            <div
              key={connection.id}
              className={
                cn(
                  "flex flex-col gap-2 rounded-lg border bg-muted/30 p-3",
                  connection.default && "bg-primary/20"
                )
              }
            >
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
                    onClick={() => openDialog({
                      component: CreateLlmConnectionDialog,
                      props: { llm: connection }
                    })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => openDialog({
                      component: DeleteDialog,
                      props: {
                        title: "Delete LLM connection?",
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
        <Button type="button" onClick={addNewConnection}>
          New connection
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
