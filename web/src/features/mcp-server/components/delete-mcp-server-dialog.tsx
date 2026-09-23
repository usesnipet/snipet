import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { useDeleteMcpServer } from "../hooks";

import type { McpServer } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type DeleteMcpServerDialogProps = DialogInstanceProps<{
  server: McpServer;
}>;

export function DeleteMcpServerDialog({ server, close }: DeleteMcpServerDialogProps) {
  const { mutateAsync, isPending } = useDeleteMcpServer();

  const handleConfirm = async () => {
    await mutateAsync(server.id);
    close();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Remove MCP server?</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{server.name}</span> and the tools it
          provides will no longer be available to your agents. This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button variant="destructive" disabled={isPending} onClick={handleConfirm}>
          {isPending && <Spinner size="sm" />}
          Remove
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
