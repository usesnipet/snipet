import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useBeforeUnload, useBlocker } from "react-router";

/**
 * Asks before leaving the page while `when` holds: a dialog for in-app navigation
 * (links, Cancel, the browser's back button), the browser's own prompt for
 * closing or reloading the tab.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );

  useBeforeUnload((event) => {
    if (when) event.preventDefault();
  });

  if (blocker.state !== "blocked") return null;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && blocker.reset()}>
      <ConfirmDialog
        id="unsaved-changes"
        title="Discard unsaved changes?"
        description="Your changes will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed()}
        close={() => {}}
      />
    </Dialog>
  );
}
