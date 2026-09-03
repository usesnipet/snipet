import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { useDeleteLlmProvider } from "../hooks";

import type { LlmProvider } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type DeleteLlmProviderDialogProps = DialogInstanceProps<{
  llm: LlmProvider;
}>;

export function DeleteLlmProviderDialog({ llm, close }: DeleteLlmProviderDialogProps) {
  const { mutateAsync, isPending } = useDeleteLlmProvider();

  const handleConfirm = async () => {
    await mutateAsync(llm.id);
    close();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete LLM?</DialogTitle>
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
