import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol";
import z from "zod";

import { env } from "../../../env.js";

import { validateOptions } from "./utils.js";

import type { Action, ActionDriver, ActionResult } from "../driver.js";

const optionsSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().min(1).default(10),
});
type McpActionOptions = z.infer<typeof optionsSchema>;

// Actions are the tools of a remote MCP server. Only the http transport:
// stdio would let a manifest run commands on the host.
// ponytail: one MCP session per call (McpConnector), pool by connectionId if latency matters.
export class McpActionDriver implements ActionDriver<McpActionOptions> {
  readonly key = "mcp";

  constructor() {}

  validateOptions(options: unknown): McpActionOptions {
    return validateOptions<McpActionOptions>(optionsSchema, options);
  }

  async listActions(_connectionId: string, options: McpActionOptions): Promise<Action[]> {
    return this.withSession(options, async (client, opts) => {
      const actions: Action[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools({ cursor }, opts);
        for (const t of page.tools) {
          actions.push({
            name: t.name,
            description: t.description ?? "",
            inputSchema: t.inputSchema,
          });
        }
        cursor = page.nextCursor;
      } while (cursor);
      return actions;
    });
  }

  callAction(
    _connectionId: string,
    name: string,
    parameters: Record<string, unknown>,
    options: McpActionOptions,
  ): Promise<ActionResult> {
    return this.withSession(options, async (client, opts) => {
      const result = await client.callTool(
        {
          name,
          arguments: parameters,
        },
        undefined,
        opts,
      );
      const content = result.content as ({ type: string; text?: string } & Record<string, unknown>)[];
      const parts = (content ?? []).map((c) => (c.type === "text" ? c.text! : JSON.stringify(c)));
      if (parts.length === 0 && result.structuredContent != null) parts.push(JSON.stringify(result.structuredContent));
      return { content: parts.join("\n"), isError: !!result.isError };
    });
  }

  private async withSession<T>(
    options: McpActionOptions,
    fn: (client: Client, opts: RequestOptions) => Promise<T>,
  ): Promise<T> {
    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
      requestInit: { headers: options.headers },
    });
    const ms = (options.timeout ?? 10) * 1000;
    const opts: RequestOptions = { signal: AbortSignal.timeout(ms), timeout: ms };
    const client = new Client({ name: "snipet", version: env.APP_VERSION });
    try {
      await client.connect(transport, opts);
      return await fn(client, opts);
    } finally {
      await client.close(); // also kills a stdio process
    }
  }
}
