import { DeleteDialog } from "@/components/confirm-dialog";
import { ConnectionListBody } from "@/components/connection-list-body";
import { IconAction } from "@/components/icon-action";
import { SyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  syncState,
  useDeleteLlmConnection,
  useListLlmConnections,
  useLlmConnectionModels,
  useSyncLlmConnection,
} from "@snipet/client";
import { FlaskConical, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { CreateLlmConnectionDialog, TestLlmConnectionDialog } from "./dialogs";

import type { LlmConnection } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";
type LlmConnectionListDialogProps = DialogInstanceProps<{
  llm: { name: string; key: string };
}>;

export function LlmConnectionListDialog({ llm: { key, name } }: LlmConnectionListDialogProps) {
  const connectionsQuery = useListLlmConnections();
  const { openDialog } = useDialog();
  const connections = connectionsQuery.data?.data.filter((connection) => connection.llmKey === key) ?? [];
  const isEmpty = connectionsQuery.isSuccess && connections.length === 0;

  const addNewConnection = () => {
    openDialog({
      component: CreateLlmConnectionDialog,
      props: { defaultValues: { llmKey: key } },
    });
  };

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{name} connections</DialogTitle>
        <DialogDescription>Agents use the default one when they don't pick a connection.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-2">
        <ConnectionListBody query={connectionsQuery} isEmpty={isEmpty} name={name} onAdd={addNewConnection}>
          {connections.map((connection) => (
            <LlmConnectionRow key={connection.id} connection={connection} />
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

/** One connection with its sync state and actions; Test and Sync stay visible, the rest live in the menu. */
function LlmConnectionRow({ connection }: { connection: LlmConnection }) {
  const { openDialog } = useDialog();
  const { mutateAsync: deleteConnection } = useDeleteLlmConnection();
  const { mutate: sync, isPending: isSyncing } = useSyncLlmConnection();
  const syncStatus = syncState(connection);
  const { data: models } = useLlmConnectionModels(syncStatus.kind === "synced" ? connection.id : "");

  const openEdit = () => openDialog({ component: CreateLlmConnectionDialog, props: { llm: connection } });
  const openTest = () => openDialog({ component: TestLlmConnectionDialog, props: { connection } });
  const openDelete = () =>
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete LLM connection?",
        description: (
          <>
            This will permanently delete <span className="font-medium text-foreground">{connection.name}</span>. This
            action cannot be undone.
          </>
        ),
        onConfirm: () => deleteConnection(connection.id),
      },
    });

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium leading-none">{connection.name}</span>
          {!connection.enabled && <Badge variant="outline">Disabled</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction tooltip="Sync models">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Sync ${connection.name}`}
              disabled={isSyncing}
              onClick={() => sync(connection.id)}
            >
              <RefreshCw className={cn(isSyncing && "animate-spin")} />
            </Button>
          </IconAction>
          <IconAction tooltip="Test">
            <Button variant="ghost" size="icon-sm" aria-label={`Test ${connection.name}`} onClick={openTest}>
              <FlaskConical />
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
          {models && (
            <span className="text-muted-foreground shrink-0">
              · {models.length} {models.length === 1 ? "model" : "models"}
            </span>
          )}
        </div>
        {syncStatus.kind === "error" && (
          <Button variant="link" size="xs" className="h-auto shrink-0 p-0" onClick={openEdit}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}
