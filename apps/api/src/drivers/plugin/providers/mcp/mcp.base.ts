import { Driver } from "#src/core/manifest/driver.js";
import { env } from "#src/env.js";
import { safeFetch } from "#src/infra/http/safe-fetch.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import z from "zod";

import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol";

const optionsSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().min(1).default(10),
});
export type MCPOptions = z.infer<typeof optionsSchema>;

/**
 * Tools are the ones of a remote MCP server and instructions the ones it
 * sends on initialize. Only the http transport is supported.
 */
export class MCPDriver extends Driver(optionsSchema) {
  readonly key = "mcp";

  protected async withSession<T>(
    options: MCPOptions,
    fn: (client: Client, opts: RequestOptions) => Promise<T>,
  ): Promise<T> {
    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
      requestInit: { headers: options.headers },
      fetch: safeFetch,
    });
    const ms = options.timeout * 1000;
    const opts: RequestOptions = { signal: AbortSignal.timeout(ms), timeout: ms };
    const client = new Client({ name: "snipet", version: env.APP_VERSION });
    try {
      await client.connect(transport, opts);
      return await fn(client, opts);
    } catch (err) {
      // Its message holds the response body, which ends up in tool results and lastSyncedError.
      if (err instanceof StreamableHTTPError) throw new Error(`MCP server answered HTTP ${err.code}`, { cause: err });
      throw err;
    } finally {
      await client.close(); // also kills a stdio process
    }
  }
}
