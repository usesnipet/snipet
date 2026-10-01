import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Injectable } from "@nestjs/common";
import { mcpConfigSchemas, McpTransport } from "@snipet/shared";

import { env } from "../../env.js";

import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const DEFAULT_TIMEOUT_SECONDS = 30;

// A tool as advertised by an MCP server.
export interface RemoteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// The outcome of a tool call, flattened to text.
export interface CallResult {
  content: string;
  isError: boolean;
}

// Talks to MCP servers. Every call opens its own session and closes it
// before returning; the config timeout bounds the whole call, connection included.
@Injectable()
export class McpConnector {
  listTools(transport: McpTransport, config: unknown): Promise<RemoteTool[]> {
    return withSession(transport, config, async (client, opts) => {
      const tools: RemoteTool[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools({ cursor }, opts);
        for (const t of page.tools) {
          tools.push({ name: t.name, description: t.description ?? "", inputSchema: t.inputSchema });
        }
        cursor = page.nextCursor;
      } while (cursor);
      return tools;
    });
  }

  callTool(
    transport: McpTransport,
    config: unknown,
    name: string,
    args?: Record<string, unknown>,
  ): Promise<CallResult> {
    return withSession(transport, config, async (client, opts) => {
      const res = await client.callTool({ name, arguments: args }, undefined, opts);
      return flattenResult(res as FlattenInput);
    });
  }
}

async function withSession<T>(
  transport: McpTransport,
  config: unknown,
  fn: (client: Client, opts: RequestOptions) => Promise<T>,
): Promise<T> {
  const { transport: conn, timeout } = newTransport(transport, config);
  const ms = timeout * 1000;
  const opts: RequestOptions = { signal: AbortSignal.timeout(ms), timeout: ms };
  const client = new Client({ name: "snipet", version: env.APP_VERSION });
  try {
    await client.connect(conn, opts);
    return await fn(client, opts);
  } finally {
    await client.close(); // also kills a stdio process
  }
}

function newTransport(transport: McpTransport, config: unknown): { transport: Transport; timeout: number } {
  if (transport === McpTransport.HTTP) {
    const cfg = mcpConfigSchemas.http.parse(config);
    return {
      transport: new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers } }),
      timeout: cfg.timeout ?? DEFAULT_TIMEOUT_SECONDS,
    };
  }
  const cfg = mcpConfigSchemas.stdio.parse(config);
  return {
    transport: new StdioClientTransport({ command: cfg.command, args: cfg.args, stderr: "ignore" }),
    timeout: cfg.timeout ?? DEFAULT_TIMEOUT_SECONDS,
  };
}

interface FlattenInput {
  content?: ({ type: string; text?: string } & Record<string, unknown>)[];
  structuredContent?: unknown;
  isError?: boolean;
}

// Joins text content with newlines and JSON-encodes any other content
// (images, resources...). Structured content is used when there is no content.
export function flattenResult(res: FlattenInput): CallResult {
  const parts = (res.content ?? []).map((c) => (c.type === "text" ? c.text! : JSON.stringify(c)));
  if (parts.length === 0 && res.structuredContent != null) parts.push(JSON.stringify(res.structuredContent));
  return { content: parts.join("\n"), isError: res.isError ?? false };
}
