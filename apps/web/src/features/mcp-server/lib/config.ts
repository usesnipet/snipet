import type {
  CreateMcpServer,
  McpServer,
  McpServerForm,
  McpServerRegistryItem,
  McpTransport,
} from "../schemas";

type ServerLike = { transport: McpTransport; config: Record<string, unknown> };

const SAFE_ARG = /^[\w@%+=:,./-]+$/;

/** Splits a shell-like command line into argv, honoring quotes and backslash escapes. */
export function parseCommandLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let started = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < line.length) current += line[++i];
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === "\\" && i + 1 < line.length) {
      current += line[++i];
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) out.push(current);
      current = "";
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) out.push(current);
  return out;
}

/** Inverse of {@link parseCommandLine}: single-quotes any arg that needs it. */
export function formatCommandLine(parts: string[]): string {
  return parts
    .map((part) => (SAFE_ARG.test(part) ? part : `'${part.replaceAll("'", `'\\''`)}'`))
    .join(" ");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function emptyForm(transport: McpTransport = "stdio"): McpServerForm {
  return { name: "", transport, commandLine: "", url: "", headers: [], timeout: "30" };
}

export function toForm(name: string, transport: McpTransport, config: Record<string, unknown>): McpServerForm {
  const timeout = typeof config.timeout === "number" ? String(config.timeout) : "";
  if (transport === "http") {
    return {
      ...emptyForm("http"),
      name,
      url: asString(config.url),
      headers: Object.entries(asStringRecord(config.headers)).map(([key, value]) => ({ key, value })),
      timeout,
    };
  }
  const command = asString(config.command);
  return {
    ...emptyForm("stdio"),
    name,
    commandLine: command ? formatCommandLine([command, ...asStringArray(config.args)]) : "",
    timeout,
  };
}

export function fromForm(form: McpServerForm): CreateMcpServer {
  const timeout = form.timeout ? Number(form.timeout) : undefined;
  if (form.transport === "http") {
    const headers = Object.fromEntries(
      form.headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]),
    );
    return {
      name: form.name.trim(),
      transport: "http",
      config: {
        url: form.url.trim(),
        ...(Object.keys(headers).length ? { headers } : {}),
        ...(timeout ? { timeout } : {}),
      },
    };
  }
  const [command, ...args] = parseCommandLine(form.commandLine);
  return {
    name: form.name.trim(),
    transport: "stdio",
    config: { command, args, ...(timeout ? { timeout } : {}) },
  };
}

/** One-line human summary of how the server is reached (command line or URL). */
export function describeConfig({ transport, config }: ServerLike): string {
  if (transport === "http") return asString(config.url);
  const command = asString(config.command);
  return command ? formatCommandLine([command, ...asStringArray(config.args)]) : "";
}

// Identity used to tell which registry entry an installed server came from:
// the URL for http, the command plus its package (first non-flag arg) for stdio.
function identity({ transport, config }: ServerLike): string {
  if (transport === "http") return `http:${asString(config.url).replace(/\/+$/, "")}`;
  const pkg = asStringArray(config.args).find((arg) => !arg.startsWith("-")) ?? "";
  return `stdio:${asString(config.command)} ${pkg}`;
}

export function matchRegistryItem(
  server: ServerLike,
  registry: McpServerRegistryItem[],
): McpServerRegistryItem | undefined {
  const id = identity(server);
  return registry.find((item) => identity(item) === id);
}

export type SyncState =
  | { kind: "pending" }
  | { kind: "error"; message: string; at?: Date }
  | { kind: "synced"; at: Date };

export function syncState(server: McpServer): SyncState {
  const at = server.last_synced_at ?? undefined;
  if (server.last_synced_error) return { kind: "error", message: server.last_synced_error, at };
  return at ? { kind: "synced", at } : { kind: "pending" };
}
