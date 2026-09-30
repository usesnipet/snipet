import { useShallow } from "zustand/react/shallow";

import { useDialogStore } from "./store";

export function useDialog() {
  return useDialogStore(
    useShallow((s) => ({
      openDialog: s.openDialog,
      closeDialog: s.closeDialog,
      closeAllDialogs: s.closeAllDialogs,
    })),
  );
}
