import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { useDeleteSession } from "../hooks";

import type { AgentSession } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type DeleteSessionDialogProps = DialogInstanceProps<{
  session: AgentSession;
  onDeleted?: () => void;
}>;

export function DeleteSessionDialog({ session, onDeleted, close }: DeleteSessionDialogProps) {
  const { mutateAsync, isPending } = useDeleteSession();

  const handleConfirm = async () => {
    await mutateAsync(session.id);
    onDeleted?.();
    close();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete chat?</DialogTitle>
        <DialogDescription>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">{session.title || "this chat"}</span>{" "}
          and all its messages. This action cannot be undone.
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
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
