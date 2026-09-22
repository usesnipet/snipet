import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";

import { mcpServerSchema, mcpTransportSchema } from "@/models/mcp-server";

export {
  mcpHttpConfigSchema,
  mcpServerSchema,
  mcpStdioConfigSchema,
  mcpTransportSchema,
} from "@/models/mcp-server";
export type {
  McpHttpConfig,
  McpServer,
  McpStdioConfig,
  McpTransport,
} from "@/models/mcp-server";

export const createMcpServerSchema = mcpServerSchema
  .pick({
    name: true,
    transport: true,
    config: true,
  })
  .strict();
export type CreateMcpServer = z.infer<typeof createMcpServerSchema>;

export const updateMcpServerSchema = createMcpServerSchema.partial().strict();
export type UpdateMcpServer = z.infer<typeof updateMcpServerSchema>;

export const paginatedMcpServerSchema = paginatedSchema(mcpServerSchema);
export type PaginatedMcpServer = z.infer<typeof paginatedMcpServerSchema>;

export const listMcpServersSearchParamsSchema = paginationParamsSchema;
export type ListMcpServersSearchParams = z.infer<
  typeof listMcpServersSearchParamsSchema
>;

// Registry entry — a known MCP server with its default config
// (mcp.MCPServersRegistryItem), as returned by GET /api/mcp-server/registry.
// No id and no relations, so it stays here rather than in @/models.
export const mcpServerRegistryItemSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    tags: z.array(z.string()),
    transport: mcpTransportSchema,
    config: z.record(z.string(), z.unknown()),
  })
  .strict();
export type McpServerRegistryItem = z.infer<typeof mcpServerRegistryItemSchema>;

export const listMcpServerRegistrySchema = z.array(mcpServerRegistryItemSchema);
export type ListMcpServerRegistry = z.infer<typeof listMcpServerRegistrySchema>;
