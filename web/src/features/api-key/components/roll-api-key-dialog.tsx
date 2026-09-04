import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { useRollApiKey } from "../hooks";

import type { ApiKey, ApiKeyWithSecret } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type RollApiKeyDialogProps = DialogInstanceProps<{
  apiKey: ApiKey
  onRolled: (apiKey: ApiKeyWithSecret) => void
}>;

export function RollApiKeyDialog({ apiKey, onRolled, close }: RollApiKeyDialogProps) {
  const { mutateAsync, isPending } = useRollApiKey();

  const handleConfirm = async () => {
    const result = await mutateAsync({ id: apiKey.id });
    close();
    onRolled(result);
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Roll API key?</DialogTitle>
        <DialogDescription>
          This will generate a new secret for{" "}
          <span className="font-medium text-foreground">{apiKey.name}</span>.
          The previous secret will stop working immediately.
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
          Roll key
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
