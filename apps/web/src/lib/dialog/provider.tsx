/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from "react";

import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SnipetLoader } from "@/components/snipet-loader";

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
            {/* Dialogs are lazy-loaded on first open; until the code arrives, a small loading panel stands in. */}
            <Suspense fallback={<DialogLoading />}>
              <Component {...(dialogProps as any)} />
            </Suspense>
          </Dialog>
        );
      })}
    </>
  );
}

/**
 * Stand-in while a lazy dialog's code downloads. The overlay dims the page at
 * once, so the click visibly did something; the panel waits 150 ms (animation
 * delay) so a dialog that loads fast never flashes it. Escape and a click on
 * the overlay still close it, since it's a real dialog.
 */
function DialogLoading() {
  return (
    <DialogContent className="w-auto p-6 delay-150 fill-mode-backwards sm:max-w-none" showCloseButton={false} aria-busy>
      <DialogTitle className="sr-only">Loading</DialogTitle>
      <DialogDescription className="sr-only">The dialog is loading.</DialogDescription>
      {/* The panel already waits 150 ms, so the loader skips its own fade-in delay. */}
      <SnipetLoader size="md" className="flex-none delay-0" />
    </DialogContent>
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
