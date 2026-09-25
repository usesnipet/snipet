import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

import type { DialogInstanceProps } from "@/lib/dialog";

type ConfirmDialogOptions = {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Runs on confirm; the dialog stays open with a spinner until it resolves, and stays open if it throws. */
  onConfirm: () => unknown;
};

export type ConfirmDialogProps = DialogInstanceProps<ConfirmDialogOptions>;

export type ConfirmPromptDialogProps = DialogInstanceProps<ConfirmDialogOptions & {
  /** Text the user must type exactly to enable the confirm button. */
  confirmationText: string;
}>;

function BaseConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  close,
  confirmationText,
}: ConfirmDialogProps & { confirmationText?: string }) {
  const [isPending, setIsPending] = useState(false);
  const [typed, setTyped] = useState("");

  const canConfirm = confirmationText === undefined || typed === confirmationText;

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      close();
    } catch {
      setIsPending(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm && !isPending) handleConfirm();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {confirmationText !== undefined && (
          <div className="grid gap-2">
            <Label htmlFor="confirm-dialog-input">
              Type <span className="font-mono font-semibold">{confirmationText}</span> to confirm
            </Label>
            <Input
              id="confirm-dialog-input"
              autoComplete="off"
              autoFocus
              value={typed}
              disabled={isPending}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            variant={destructive ? "destructive" : "default"}
            disabled={isPending || !canConfirm}
          >
            {isPending && <Spinner size="sm" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return <BaseConfirmDialog {...props} />;
}

export function DeleteDialog(props: ConfirmDialogProps) {
  return <BaseConfirmDialog confirmLabel="Delete" destructive {...props} />;
}

export function ConfirmPromptDialog(props: ConfirmPromptDialogProps) {
  return <BaseConfirmDialog {...props} />;
}
