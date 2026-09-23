import type { CreateMcpServer } from "../schemas";

export type ImportResult = {
  servers: CreateMcpServer[];
  /** Non-fatal notes about fields that were dropped. */
  warnings: string[];
};

const HTTP_TYPES = new Set(["http", "sse", "streamable-http", "streamableHttp"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toServer(name: string, raw: Record<string, unknown>, warnings: string[]): CreateMcpServer {
  const timeout = typeof raw.timeout === "number" && raw.timeout > 0 ? { timeout: raw.timeout } : {};
  const url = typeof raw.url === "string" ? raw.url : typeof raw.serverUrl === "string" ? raw.serverUrl : undefined;

  if (url || (typeof raw.type === "string" && HTTP_TYPES.has(raw.type))) {
    if (!url) throw new Error(`"${name}" has no url.`);
    const headers = isObject(raw.headers)
      ? Object.fromEntries(Object.entries(raw.headers).map(([k, v]) => [k, String(v)]))
      : undefined;
    return { name, transport: "http", config: { url, ...(headers ? { headers } : {}), ...timeout } };
  }

  if (typeof raw.command !== "string" || !raw.command) {
    throw new Error(`"${name}" needs either a "command" or a "url".`);
  }
  if (isObject(raw.env) && Object.keys(raw.env).length) {
    warnings.push(`"${name}": env variables are not supported yet and were ignored.`);
  }
  const args = Array.isArray(raw.args) ? raw.args.map(String) : [];
  return { name, transport: "stdio", config: { command: raw.command, args, ...timeout } };
}

/**
 * Parses the MCP config snippets servers publish in their READMEs:
 * `{"mcpServers": {...}}` (Claude Desktop, Cursor), `{"servers": {...}}`
 * (VS Code), a bare `{name: server}` map, or a single server object.
 */
export function parseMcpJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That isn't valid JSON.");
  }
  if (!isObject(parsed)) throw new Error("Expected a JSON object.");

  const warnings: string[] = [];
  const root = isObject(parsed.mcpServers) ? parsed.mcpServers : isObject(parsed.servers) ? parsed.servers : parsed;

  if ("command" in root || "url" in root) {
    const name = typeof root.name === "string" && root.name ? root.name : "Custom server";
    return { servers: [toServer(name, root, warnings)], warnings };
  }

  const entries = Object.entries(root).filter((entry): entry is [string, Record<string, unknown>] => isObject(entry[1]));
  if (!entries.length) throw new Error("No servers found in that JSON.");
  return { servers: entries.map(([name, raw]) => toServer(name, raw, warnings)), warnings };
}
