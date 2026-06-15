import { create } from "zustand";

import { DialogType, isDialogType } from "../dialogs";

import type { DialogPropsMap, OpenDialogOptions, OpenDialogResult } from "../dialogs";

type StackEntry = {
  [K in DialogType]: {
    id: string;
    type: K;
    props: DialogPropsMap[K];
    onClose?: () => void;
  };
}[DialogType];

type DialogStoreState = {
  stack: StackEntry[];
};

type DialogStoreActions = {
  openDialog: <T extends DialogType>(opts: OpenDialogOptions<T>) => OpenDialogResult;
  /** Pass a `DialogType` to close every open dialog of that type, or an instance id to close one dialog. */
  closeDialog: (target: DialogType | string) => void;
  closeAllDialogs: () => void;
  /** @internal */
  closeById: (id: string) => void;
};

export type DialogStore = DialogStoreState & DialogStoreActions;

export const useDialogStore = create<DialogStore>((set, get) => ({
  stack: [],

  closeById: (id) => {
    set((s) => {
      const entry = s.stack.find((e) => e.id === id);
      if (entry) {
        entry.onClose?.();
      }
      return { stack: s.stack.filter((e) => e.id !== id) };
    });
  },

  openDialog: (opts) => {
    const id = crypto.randomUUID();
    set((s) => ({
      stack: [
        ...s.stack,
        {
          id,
          type: opts.type,
          props: opts.props,
          onClose: opts.onClose,
        } as StackEntry,
      ],
    }));
    return {
      id,
      close: () => {
        get().closeById(id);
      },
    };
  },

  closeDialog: (target) => {
    if (isDialogType(target)) {
      set((s) => {
        const removed = s.stack.filter((e) => e.type === target);
        for (const e of removed) {
          e.onClose?.();
        }
        return { stack: s.stack.filter((e) => e.type !== target) };
      });
      return;
    }
    get().closeById(target);
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
