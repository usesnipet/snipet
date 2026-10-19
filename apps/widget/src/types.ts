// The widget's public contract: what `window.SnipetWidget` and the loader expose.
// Kept free of runtime imports so it compiles into the loader's .d.ts on its own.

export type Theme = "light" | "dark" | "auto";
export type Size = "sm" | "md" | "lg";

export type WidgetConfig = {
  /** Snipet API base URL. */
  apiUrl: string;
  /** App with allowAnonymous on: without a token, the widget signs in its own anonymous end user. */
  appId?: string;
  /** Agent the widget chats with. */
  agentId?: string;
  /** End-user app token, from POST /apps/issue-token on the host's backend. */
  token?: string;
  /** Called when the token is rejected (e.g. expired); resolve a fresh one, or null to give up. */
  getToken?: () => Promise<string | null | undefined>;
  theme: Theme;
  size: Size;
  /** Corner radius of the panel, in px. */
  radius: number;
  /** Any CSS color. Unset keeps the theme's default. */
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  /** Stylesheet loaded inside the shadow root, after the base styles. */
  cssUrl?: string;
  /** Raw CSS injected inside the shadow root, after the base styles. */
  css?: string;
  open: boolean;
  enabled: boolean;
};

/** What init() takes: apiUrl is required, everything else has a default. */
export type WidgetInit = Partial<WidgetConfig> & Pick<WidgetConfig, "apiUrl">;

/** A chat message, user or assistant, once it is complete. */
export type WidgetMessage = { role: "user" | "assistant"; text: string; sessionId: string };

/** Event name to the payload its handlers receive. */
export type WidgetEvents = {
  open: void;
  close: void;
  message: WidgetMessage;
  error: { message: string };
};

export type WidgetEvent = keyof WidgetEvents;

export type WidgetApi = {
  /** Mounts the widget; when it is already mounted, applies the config like configure(). */
  init: (config: WidgetInit) => void;
  /** Unmounts the widget and resets its config. Event handlers stay subscribed. */
  destroy: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
  configure: (patch: Partial<WidgetConfig>) => void;
  setToken: (token: string | null) => void;
  /** Subscribes to an event; returns the unsubscribe. */
  on: <E extends WidgetEvent>(event: E, handler: (payload: WidgetEvents[E]) => void) => () => void;
};

declare global {
  interface Window {
    SnipetWidget?: WidgetApi;
  }
}
