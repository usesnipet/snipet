import { useSyncExternalStore } from "react";

import type { Size, WidgetConfig } from "./types";

export type { WidgetConfig } from "./types";

const SIZE_SCALE: Record<Size, number> = { sm: 0.875, md: 1, lg: 1.125 };

export const DEFAULTS: WidgetConfig = {
  apiUrl: "",
  theme: "light",
  size: "md",
  radius: 16,
  open: false,
  enabled: true,
};

let state = DEFAULTS;
const listeners = new Set<() => void>();

export const widgetStore = {
  get: () => state,
  set: (patch: Partial<WidgetConfig>) => {
    // Wrappers re-apply their whole config on every render; skip the no-ops.
    if (Object.entries(patch).every(([key, value]) => state[key as keyof WidgetConfig] === value)) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  },
  /** Back to DEFAULTS without notifying: only for destroy(), once nothing listens. */
  reset: () => {
    state = DEFAULTS;
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// applyHostStyle puts theme, size and color overrides on the <snipet-widget> element:
// inline vars beat both the :host defaults and the host page's own snipet-widget rules.
export function applyHostStyle(host: HTMLElement, config: WidgetConfig) {
  const vars: Record<string, string | undefined> = {
    "--sw-scale": String(SIZE_SCALE[config.size]),
    "--sw-radius": `${config.radius}px`,
    "--sw-accent": config.primaryColor,
    "--sw-surface": config.backgroundColor,
    "--sw-text": config.textColor,
  };
  for (const [name, value] of Object.entries(vars)) {
    if (value) host.style.setProperty(name, value);
    else host.style.removeProperty(name);
  }
  host.style.colorScheme = config.theme === "auto" ? "light dark" : config.theme;
}

export const useWidgetConfig = () => useSyncExternalStore(widgetStore.subscribe, widgetStore.get);

/** The app token's "<app id>:<end user id>", to tell users apart (no signature check: that's the API's job). */
export function tokenOwner(token: string | undefined): string | undefined {
  try {
    const payload = JSON.parse(atob(token!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return `${payload.app.id}:${payload.sub}`;
  } catch {
    return undefined;
  }
}
