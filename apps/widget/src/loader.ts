// npm entry of @snipet/widget: loads the widget script from the CDN and queues
// calls until it is there. The framework wrappers (@snipet/react-widget, @snipet/angular-widget) build on it.

import type { WidgetApi, WidgetInit } from "./types";

export type * from "./types";

declare const __WIDGET_VERSION__: string;

/** The widget build matching this package's version. */
export const WIDGET_SRC = `https://unpkg.com/@snipet/widget@${__WIDGET_VERSION__}/dist/widget.js`;

let resolveApi!: (api: WidgetApi) => void;
/** Every call chains on this, so they run in order once the script is there (init, then destroy, then init...). */
let queue = new Promise<WidgetApi>((resolve) => (resolveApi = resolve));
let loading = false;

function enqueue(call: (api: WidgetApi) => void) {
  queue = queue.then((api) => {
    try {
      call(api);
    } catch (error) {
      console.error(error);
    }
    return api;
  });
}

function load(src: string) {
  if (loading) return;
  loading = true;
  // The page may already carry the <script> tag.
  if (window.SnipetWidget) return resolveApi(window.SnipetWidget);
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.onload = () => resolveApi(window.SnipetWidget!);
  // Calls stay queued: nothing to run them on.
  script.onerror = () => console.error(`Snipet widget failed to load from ${src}`);
  document.head.appendChild(script);
}

/** WidgetApi, callable before the script loads: calls queue and run in order. */
export type Snipet = Omit<WidgetApi, "init"> & {
  /** Loads the script (once, from `src`) and mounts the widget. */
  init: (config: WidgetInit, src?: string) => void;
};

export const snipet: Snipet = {
  init: (config, src = WIDGET_SRC) => {
    load(src);
    enqueue((api) => api.init(config));
  },
  destroy: () => enqueue((api) => api.destroy()),
  open: () => enqueue((api) => api.open()),
  close: () => enqueue((api) => api.close()),
  toggle: () => enqueue((api) => api.toggle()),
  enable: () => enqueue((api) => api.enable()),
  disable: () => enqueue((api) => api.disable()),
  configure: (patch) => enqueue((api) => api.configure(patch)),
  setToken: (token) => enqueue((api) => api.setToken(token)),
  on: (event, handler) => {
    let off: (() => void) | undefined;
    let cancelled = false;
    enqueue((api) => {
      if (!cancelled) off = api.on(event, handler);
    });
    return () => {
      cancelled = true;
      off?.();
    };
  },
};
