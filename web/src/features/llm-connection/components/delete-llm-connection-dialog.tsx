import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { useDeleteLlmConnection } from "../hooks";

import type { LlmConnection } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type DeleteLlmConnectionDialogProps = DialogInstanceProps<{
  llm: LlmConnection;
}>;

export function DeleteLlmConnectionDialog({ llm, close }: DeleteLlmConnectionDialogProps) {
  const { mutateAsync, isPending } = useDeleteLlmConnection();

  const handleConfirm = async () => {
    await mutateAsync(llm.id);
    close();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete LLM connection?</DialogTitle>
        <DialogDescription>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">{llm.name}</span>.
          This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={handleConfirm}
        >
          {isPending && <Spinner size="sm" />}
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
