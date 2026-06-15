import { Button } from "@/components/ui/button";
import {
  DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Check, X } from "lucide-react";

import type { ReactNode } from "react";
import type { DialogInstanceProps } from "./types";

export type ConfirmDialogProps = DialogInstanceProps<{
  title: string;
  description: string;
  confirm: { text?: string; action: () => Promise<void> | void; icon?: ReactNode };
  cancel?: { text?: string; action?: () => Promise<void> | void; icon?: ReactNode };
}>;

export const ConfirmDialog = ({ close, description, title, confirm, cancel }: ConfirmDialogProps) => {
  const cancelText = cancel?.text ?? "No";
  const cancelIcon = cancel?.icon ?? <X />;
  const confirmText = confirm.text ?? "Yes";
  const confirmIcon = confirm.icon ?? <Check />;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="destructive" onClick={async () => {
          await cancel?.action?.();
          close();
        }}>
          {cancelIcon} {cancelText}
        </Button>
        <Button
          onClick={async () => {
            await confirm.action?.();
            close();
          }}
        >
          {confirmIcon} {confirmText}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
