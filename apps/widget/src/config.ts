import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "auto";
export type Size = "sm" | "md" | "lg";

export type WidgetConfig = {
  apiUrl: string;
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

const THEMES: Theme[] = ["light", "dark", "auto"];
const SIZES: Size[] = ["sm", "md", "lg"];

const SIZE_SCALE: Record<Size, number> = { sm: 0.875, md: 1, lg: 1.125 };

const oneOf = <T extends string>(value: string | undefined, options: T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

// `data-open` and `data-open="true"` both mean true; only "false" turns it off.
const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value !== "false";

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Reads the options from the embedding <script>'s data-* attributes. */
export function parseConfig(data: DOMStringMap): WidgetConfig {
  return {
    apiUrl: data.apiUrl ?? "",
    theme: oneOf(data.theme, THEMES, "light"),
    size: oneOf(data.size, SIZES, "md"),
    radius: number(data.radius, 16),
    primaryColor: data.primaryColor,
    backgroundColor: data.backgroundColor,
    textColor: data.textColor,
    cssUrl: data.cssUrl,
    open: bool(data.open, false),
    enabled: bool(data.enabled, true),
  };
}

let state: WidgetConfig = parseConfig({});
const listeners = new Set<() => void>();

export const widgetStore = {
  get: () => state,
  set: (patch: Partial<WidgetConfig>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
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
