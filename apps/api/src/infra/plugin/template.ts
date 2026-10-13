const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

// Fills `{{path.to.value}}` placeholders in every string of `value` (nested
// objects and arrays included) from `vars`. Only values are rendered, never
// keys. A string that is exactly one placeholder takes the variable as is,
// so numbers and booleans keep their type. A missing variable throws.
export function render<T>(value: T, vars: Record<string, unknown>): T {
  if (typeof value === "string") return renderString(value, vars) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => render(v, vars)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, render(v, vars)])) as T;
  }
  return value;
}

function renderString(template: string, vars: Record<string, unknown>): unknown {
  const whole = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(template);
  if (whole) return lookup(vars, whole[1]);
  return template.replace(PLACEHOLDER, (_, path: string) => String(lookup(vars, path)));
}

function lookup(vars: Record<string, unknown>, path: string): unknown {
  let current: unknown = vars;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, part)) {
      throw new Error(`template variable "${path}" is not set`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
