/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";

import { Dialog } from "@/components/ui/dialog";

import { useDialogStore } from "./store";

type DialogProviderProps = {
  children: ReactNode;
};

export function DialogContainer() {
  const stack = useDialogStore((s) => s.stack);
  const closeDialog = useDialogStore((s) => s.closeDialog);

  return (
    <>
      {stack.map((entry) => {
        const dialogProps = {
          id: entry.id,
          close: () => {
            closeDialog(entry.id);
          },
          ...entry.props,
        };

        const Component = entry.component;
        if (!Component) {
          console.error(`Unknown dialog component: ${entry.component}`);
          return null;
        }

        return (
          <Dialog
            key={entry.id}
            open
            onOpenChange={(open) => {
              if (!open) {
                closeDialog(entry.id);
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
