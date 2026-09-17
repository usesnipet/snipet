import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDialog } from "@/lib/dialog";
import { cn } from "@/lib/utils";
import { Pencil, Trash } from "lucide-react";
import { useMemo } from "react";

import { useListLlmConnections } from "../hooks";

import { CreateLlmConnectionDialog } from "./create-llm-connection-dialog";
import { DeleteLlmConnectionDialog } from "./delete-llm-connection-dialog";

import type { LlmConnection } from "../schemas";

import type { DialogInstanceProps } from "@/lib/dialog";
type LlmConnectionListFromProviderDialogProps = DialogInstanceProps<{
  provider: { name: string; key: string; };
}>;

export function LlmConnectionListFromProviderDialog(
  { provider: { key, name } }: LlmConnectionListFromProviderDialogProps
) {
  const { data: connections, isLoading, error } = useListLlmConnections();
  const { openDialog } = useDialog();

  const connectionsFromProvider = useMemo<LlmConnection[]>(() => {
    if (isLoading || error) return [];
    return connections?.data.filter((connection) => connection.provider === key) ?? [];
  }, [connections, key, isLoading, error]);

  const addNewConnection = () => {
    openDialog({
      component: CreateLlmConnectionDialog,
      props: { defaultValues: { provider: key } }
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
          {connectionsFromProvider.map((connection) => (
            <div
              key={connection.id}
              className={
                cn(
                  "flex justify-between items-center gap-3 rounded-lg border bg-muted/30 p-3",
                  connection.default && "bg-primary/20"
                )
              }
            >
              <span className="text-sm font-medium leading-none">{connection.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant={connection.enabled ? "default" : "outline"}>
                  {connection.enabled ? "Enabled" : "Disabled"}
                </Badge>
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
                    component: DeleteLlmConnectionDialog,
                    props: { llm: connection }
                  })}
                >
                  <Trash />
                </Button>
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
