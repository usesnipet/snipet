/** Injected by `DialogContainer` together with your dialog-specific props. */
export type DialogInstanceProps<P extends object = object> = P & {
  id: string;
  close: () => void;
};
