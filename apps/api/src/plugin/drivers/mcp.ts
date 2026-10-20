import { env } from "#src/env.js";
import { Driver } from "#src/manifest/driver.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import z from "zod";

import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol";
import type { Action, ActionDriver, ActionResult, InstructionsDriver } from "../driver.js";
const optionsSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().min(1).default(10),
});
type McpOptions = z.infer<typeof optionsSchema>;

/**
 * Actions are the tools of a remote MCP server and instructions the ones it
 * sends on initialize. Only the http transport is supported.
 */
export class McpDriver
  extends Driver(optionsSchema)
  implements ActionDriver<McpOptions>, InstructionsDriver<McpOptions>
{
  readonly key = "mcp";

  async listActions(_connectionId: string, options: McpOptions): Promise<Action[]> {
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
    options: McpOptions,
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

  getInstructions(_connectionId: string, options: McpOptions): Promise<string | undefined> {
    return this.withSession(options, (client) => Promise.resolve(client.getInstructions()));
  }

  private async withSession<T>(
    options: McpOptions,
    fn: (client: Client, opts: RequestOptions) => Promise<T>,
  ): Promise<T> {
    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
      requestInit: { headers: options.headers },
    });
    const ms = options.timeout * 1000;
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
