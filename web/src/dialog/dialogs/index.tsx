import { ConfirmDialog } from "./confirm";

import type { ConfirmDialogProps } from "./confirm";

export const DialogType = {
  CONFIRM: "confirm",
} as const;

export type DialogType = (typeof DialogType)[keyof typeof DialogType];

export const Dialogs = {
  [DialogType.CONFIRM]: ConfirmDialog,
} as const;

type UnpackedDialogProps<T> = Omit<T, "id" | "close">;

export type DialogPropsMap = {
  [DialogType.CONFIRM]: UnpackedDialogProps<ConfirmDialogProps>;
};

export type DialogProps<T extends DialogType> = DialogPropsMap[T];

export type OpenDialogOptions<T extends DialogType = DialogType> = {
  type: T;
  props: DialogProps<T>;
  onClose?: () => void;
};

export type OpenDialogResult = {
  id: string;
  close: () => void;
};

const DIALOG_TYPE_VALUES = new Set<string>(Object.values(DialogType));

export function isDialogType(value: string): value is DialogType {
  return DIALOG_TYPE_VALUES.has(value);
}