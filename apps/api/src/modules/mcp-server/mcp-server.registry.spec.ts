import { McpTransport, mcpServerRegistryItemSchema } from "@snipet/shared";

import { checkJsonSchema } from "../../common/utils/json-schema/json-schema.js";

import { MCP_SERVERS_REGISTRY } from "./mcp-server.registry.js";

describe("MCP_SERVERS_REGISTRY", () => {
  it("has unique keys, sorted", () => {
    const keys = MCP_SERVERS_REGISTRY.map((i) => i.key);
    expect(keys).toEqual([...new Set(keys)].sort());
  });

  it.each(MCP_SERVERS_REGISTRY.map((i) => [i.key, i] as const))("%s is valid", (_, item) => {
    mcpServerRegistryItemSchema.parse(item);
    if (item.transport === McpTransport.HTTP && item.config.headersSchema) {
      const schema = item.config.headersSchema;
      checkJsonSchema(schema);
      expect(schema.type).toBe("object");
      for (const p of Object.values(schema.properties as Record<string, { type: string }>)) {
        expect(p.type).toBe("string"); // each property becomes one header value
      }
    }
    if (item.transport === McpTransport.STDIO && item.config.argsSchema) {
      const schema = item.config.argsSchema;
      checkJsonSchema(schema);
      expect(schema.type).toBe("array");
      expect((schema.items as { type: string }).type).toBe("string"); // each item becomes one argument
    }
  });
});
