/** Injected by `DialogContainer` together with your dialog-specific props. */
export type DialogInstanceProps<P extends object = object> = P & {
  id: string;
  close: () => void;
};

export type OpenDialogOptions<P extends object = object> = {
  component: React.ComponentType<DialogInstanceProps<P>>;
  props: P;
  onClose?: () => void;
};

export type OpenDialogResult = {
  id: string;
  close: () => void;
};
