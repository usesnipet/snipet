import { Tool, ToolDriver, ToolResult } from "#src/core/plugin/driver.js";

import { MCPDriver, MCPOptions } from "./mcp.base.js";

export class MCPToolsDriver extends MCPDriver implements ToolDriver<MCPOptions> {
  async listTools(_connectionId: string, options: MCPOptions): Promise<Tool[]> {
    return this.withSession(options, async (client, opts) => {
      const tools: Tool[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools({ cursor }, opts);
        for (const t of page.tools) {
          tools.push({
            name: t.name,
            description: t.description ?? "",
            inputSchema: t.inputSchema,
          });
        }
        cursor = page.nextCursor;
      } while (cursor);
      return tools;
    });
  }

  callTool(
    _connectionId: string,
    name: string,
    parameters: Record<string, unknown>,
    options: MCPOptions,
  ): Promise<ToolResult> {
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
}
