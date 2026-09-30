/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";

import type { OpenDialogOptions, OpenDialogResult } from "./types";

type StackEntry = {
  id: string;
  component: React.ComponentType<any>;
  props: any;
  onClose?: () => void;
};

type DialogStoreState = {
  stack: StackEntry[];
};

type DialogStoreActions = {
  openDialog: <P extends object>(opts: OpenDialogOptions<P>) => OpenDialogResult;
  closeDialog: (id: string) => void;
  closeAllDialogs: () => void;
};

export type DialogStore = DialogStoreState & DialogStoreActions;

export const useDialogStore = create<DialogStore>((set, get) => ({
  stack: [],

  openDialog: (opts) => {
    const id = crypto.randomUUID();
    setTimeout(() => {
      set((s) => ({
        stack: [
          ...s.stack,
          {
            id,
            ...opts,
          },
        ],
      }));
    }, 0);
    return {
      id,
      close: () => {
        get().closeDialog(id);
      },
    };
  },

  closeDialog: (id) => {
    set((s) => {
      const entry = s.stack.find((e) => e.id === id);
      if (entry) {
        entry.onClose?.();
      }
      return { stack: s.stack.filter((e) => e.id !== id) };
    });
  },

  closeAllDialogs: () => {
    set((s) => {
      for (const e of s.stack) {
        e.onClose?.();
      }
      return { stack: [] };
    });
  },
}));
