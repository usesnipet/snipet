/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";

import { Dialog } from "@/components/ui/dialog";

import { Dialogs } from "../dialogs";
import { useDialogStore } from "../store/dialog-store";

type DialogProviderProps = {
  children: ReactNode;
};

export function DialogContainer() {
  const stack = useDialogStore((s) => s.stack);
  const closeById = useDialogStore((s) => s.closeById);

  return (
    <>
      {stack.map((entry) => {
        const dialogProps = {
          id: entry.id,
          close: () => {
            closeById(entry.id);
          },
          ...entry.props
        };

        const Component = Dialogs[entry.type];
        return (
          <Dialog
            key={entry.id}
            open
            onOpenChange={(open) => {
              if (!open) {
                closeById(entry.id);
              }
            }}
          >
            <Component {...(dialogProps as any)} />
          </Dialog>
        )
      })}
    </>
  );
}

export function DialogProvider({ children }: DialogProviderProps) {
  return (
    <>
      {children}
      <DialogContainer />
    </>
  );
}
