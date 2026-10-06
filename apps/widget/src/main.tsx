import { createRoot } from "react-dom/client";

import { applyHostStyle, parseConfig, widgetStore } from "./config";
import css from "./index.css?inline";
import { Widget } from "./widget";

import type { WidgetConfig } from "./config";

const HOST_TAG = "snipet-widget";

// Host-page API: window.SnipetWidget.open(), .configure({ theme: "dark" }), ...
const api = {
  open: () => widgetStore.set({ open: true }),
  close: () => widgetStore.set({ open: false }),
  toggle: () => widgetStore.set({ open: !widgetStore.get().open }),
  enable: () => widgetStore.set({ enabled: true }),
  disable: () => widgetStore.set({ enabled: false, open: false }),
  configure: (patch: Partial<WidgetConfig>) => widgetStore.set(patch),
};

declare global {
  interface Window {
    SnipetWidget?: typeof api;
  }
}

// Guard against the script being included twice on the same page.
if (!document.querySelector(HOST_TAG)) {
  // currentScript is the embed tag; module scripts (the dev page) don't get one, so they mark it instead.
  const script = document.currentScript ?? document.querySelector<HTMLScriptElement>("script[data-snipet-widget]");
  widgetStore.set(parseConfig((script as HTMLScriptElement | null)?.dataset ?? {}));
  window.SnipetWidget = api;

  // A custom tag (not a <div>) so the host page's element selectors don't match it;
  // inline `all: initial` beats its universal (`*`) rules.
  const host = document.createElement(HOST_TAG);
  host.style.all = "initial";
  applyHostStyle(host, widgetStore.get());
  widgetStore.subscribe(() => applyHostStyle(host, widgetStore.get()));
  document.body.appendChild(host);

  // Shadow DOM isolates the widget's styles from the host page, in both directions.
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const container = document.createElement("div");
  shadow.append(style, container);

  createRoot(container).render(<Widget />);
}
