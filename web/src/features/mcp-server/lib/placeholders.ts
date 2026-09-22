/**
 * A value a registry entry's default config leaves for the user to fill in,
 * e.g. `<GITHUB_TOKEN>` inside `"Bearer <GITHUB_TOKEN>"`, or a whole
 * `/path/to/allowed/dir` argument.
 */
export type Placeholder = {
  /** Exact substring replaced by the user's value. */
  token: string;
  label: string;
  secret: boolean;
  /** Where it sits in the config, shown as a hint (e.g. `Authorization header`). */
  location: string;
};

const ANGLE_TOKEN = /<([A-Za-z][\w-]*)>/g;
const PATH_TOKEN = /^\/path\/to\/(.+)$/;
const SECRET_NAME = /token|key|secret|password|pat\b/i;

function humanize(raw: string): string {
  const words = raw.replace(/[_\-/]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function scan(value: string, location: string, found: Map<string, Placeholder>) {
  const path = PATH_TOKEN.exec(value);
  if (path && !found.has(value)) {
    found.set(value, { token: value, label: humanize(path[1]), secret: false, location });
    return;
  }
  for (const match of value.matchAll(ANGLE_TOKEN)) {
    if (found.has(match[0])) continue;
    found.set(match[0], {
      token: match[0],
      label: humanize(match[1]),
      secret: SECRET_NAME.test(match[1]),
      location,
    });
  }
}

export function findPlaceholders(config: Record<string, unknown>): Placeholder[] {
  const found = new Map<string, Placeholder>();
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") scan(value, key, found);
    else if (Array.isArray(value)) value.forEach((v) => typeof v === "string" && scan(v, "argument", found));
    else if (value && typeof value === "object") {
      for (const [innerKey, inner] of Object.entries(value)) {
        if (typeof inner === "string") scan(inner, `${innerKey} ${key === "headers" ? "header" : key}`, found);
      }
    }
  }
  return [...found.values()];
}

export function containsToken(config: unknown, token: string): boolean {
  return JSON.stringify(config).includes(JSON.stringify(token).slice(1, -1));
}

/** Deep-replaces every placeholder token in string values with the matching entry of `values`. */
export function fillPlaceholders<T>(value: T, values: Record<string, string>): T {
  if (typeof value === "string") {
    let out: string = value;
    for (const [token, replacement] of Object.entries(values)) out = out.split(token).join(replacement);
    return out as T;
  }
  if (Array.isArray(value)) return value.map((v) => fillPlaceholders(v, values)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, fillPlaceholders(v, values)]),
    ) as T;
  }
  return value;
}
