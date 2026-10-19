import { configureHttp } from "@snipet/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { anonymousToken } from "./anonymous";
import { applyHostStyle, tokenOwner, useWidgetConfig, widgetStore } from "./config";
import { emit, on } from "./events";
import css from "./index.css?inline";
import { Widget } from "./widget";

import type { WidgetApi, WidgetInit } from "./types";

const HOST_TAG = "snipet-widget";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Undoes the current init(); undefined while the widget isn't mounted. */
let teardown: (() => void) | undefined;

function mount() {
  // Anonymous mode: an appId and no token from the host. The last anonymous token
  // tells a 401 on it (renew it here) from one on the host's token (ask the host).
  let anonymous: string | undefined;
  let anonymousFor: string | undefined;
  const signInAnonymously = (renew = false) =>
    anonymousToken(widgetStore.get().appId!, renew).then((token) => {
      anonymous = token;
      widgetStore.set({ token });
      return true;
    });
  const startAnonymous = () => {
    const { appId, token, getToken } = widgetStore.get();
    if (!appId || token || getToken || anonymousFor === appId) return;
    anonymousFor = appId;
    // Stays signed out: the panel says so.
    signInAnonymously().catch((error) => emit("error", { message: errorMessage(error) }));
  };

  configureHttp({
    get baseUrl() {
      return widgetStore.get().apiUrl;
    },
    getAccessToken: () => widgetStore.get().token,
    refreshToken: async () => {
      const { appId, token: current, getToken } = widgetStore.get();
      if (appId && current && current === anonymous) return signInAnonymously(true).catch(() => false);
      const token = await getToken?.();
      if (!token) return false;
      widgetStore.set({ token });
      return true;
    },
  });

  // Every failed request reaches the host as an "error" event; the stream's errors come from Chat.
  const onError = (error: unknown) => emit("error", { message: errorMessage(error) });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });

  // Another end user's token: drop what the last one loaded (before React
  // re-renders, as this listener subscribed first) and remount the chat.
  let owner = tokenOwner(widgetStore.get().token);
  let open = widgetStore.get().open;
  const unsubscribe = [
    widgetStore.subscribe(() => {
      const next = tokenOwner(widgetStore.get().token);
      if (next !== owner) queryClient.clear();
      owner = next;
    }),
    widgetStore.subscribe(() => {
      if (widgetStore.get().open === open) return;
      open = widgetStore.get().open;
      emit(open ? "open" : "close");
    }),
    widgetStore.subscribe(startAnonymous),
  ];
  const Root = () => <Widget key={tokenOwner(useWidgetConfig().token)} />;
  startAnonymous();

  // A custom tag (not a <div>) so the host page's element selectors don't match it;
  // inline `all: initial` beats its universal (`*`) rules.
  const host = document.createElement(HOST_TAG);
  host.style.all = "initial";
  applyHostStyle(host, widgetStore.get());
  unsubscribe.push(widgetStore.subscribe(() => applyHostStyle(host, widgetStore.get())));
  document.body.appendChild(host);

  // Shadow DOM isolates the widget's styles from the host page, in both directions.
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const container = document.createElement("div");
  shadow.append(style, container);

  const root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>,
  );

  return () => {
    unsubscribe.forEach((off) => off());
    root.unmount();
    queryClient.clear();
    host.remove();
  };
}

const api: WidgetApi = {
  init: (config: WidgetInit) => {
    if (!config?.apiUrl) throw new Error("SnipetWidget.init: apiUrl is required");
    widgetStore.set(config);
    teardown ??= mount();
  },
  destroy: () => {
    teardown?.();
    teardown = undefined;
    widgetStore.reset();
  },
  open: () => widgetStore.set({ open: true }),
  close: () => widgetStore.set({ open: false }),
  toggle: () => widgetStore.set({ open: !widgetStore.get().open }),
  enable: () => widgetStore.set({ enabled: true }),
  disable: () => widgetStore.set({ enabled: false, open: false }),
  configure: (patch) => widgetStore.set(patch),
  setToken: (token) => widgetStore.set({ token: token ?? undefined }),
  on,
};

// Loading the script only exposes the API; nothing mounts until init().
// A second copy of the script keeps the first one's API (and its mounted widget).
window.SnipetWidget ??= api;
