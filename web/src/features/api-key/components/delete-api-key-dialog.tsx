import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { useDeleteApiKey } from "../hooks";

import type { ApiKey } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type DeleteApiKeyDialogProps = DialogInstanceProps<{
  apiKey: ApiKey
}>;

export function DeleteApiKeyDialog({ apiKey, close }: DeleteApiKeyDialogProps) {
  const { mutateAsync, isPending } = useDeleteApiKey();

  const handleConfirm = async () => {
    await mutateAsync({ id: apiKey.id });
    close();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete API key?</DialogTitle>
        <DialogDescription>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">{apiKey.name}</span>.
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
  )
}
