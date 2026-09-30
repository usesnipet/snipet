import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

export enum McpTransport {
  HTTP = "http",
  STDIO = "stdio",
}
// How an MCP server is reached.
export const mcpTransportSchema = z.enum(McpTransport);

export const mcpHttpConfigSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().min(1).optional(), // Timeouts are in seconds.
});
export type McpHttpConfig = z.infer<typeof mcpHttpConfigSchema>;

export const mcpStdioConfigSchema = z.strictObject({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  timeout: z.number().int().min(1).optional(),
});
export type McpStdioConfig = z.infer<typeof mcpStdioConfigSchema>;

export const mcpConfigSchemas = {
  [McpTransport.HTTP]: mcpHttpConfigSchema,
  [McpTransport.STDIO]: mcpStdioConfigSchema,
} as const;

export const mcpServerConfigSchema = z.union([mcpHttpConfigSchema, mcpStdioConfigSchema]);
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const mcpServerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  transport: mcpTransportSchema,
  config: mcpServerConfigSchema,
  // Outcome of the last tool sync; lastSyncedError is null when it succeeded.
  lastSyncedAt: z.coerce.date().nullable(),
  lastSyncedError: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type McpServer = z.infer<typeof mcpServerSchema>;

export const paginatedMcpServerSchema = paginatedSchema(mcpServerSchema);

// config is checked against transport by the API (see mcpConfigSchemas),
// since on update either one may come alone.
export const createMcpServerSchema = z.object({
  name: z.string().min(1).max(255),
  transport: mcpTransportSchema,
  config: z.record(z.string(), z.unknown()),
});
export type CreateMcpServer = z.infer<typeof createMcpServerSchema>;

export const updateMcpServerSchema = createMcpServerSchema.partial();
export type UpdateMcpServer = z.infer<typeof updateMcpServerSchema>;

export const findMcpServersParamsSchema = paginationParamsSchema;
export type FindMcpServersParams = z.infer<typeof findMcpServersParamsSchema>;

// Registry: built-in catalog of known MCP servers, for easy setup. It does
// not limit which servers can be added.

// headersSchema: JSON Schema (object of string properties) of the headers
// the user fills in when installing.
export const mcpHttpRegistryConfigSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headersSchema: z.record(z.string(), z.unknown()).optional(),
  timeout: z.number().int().min(1).optional(),
});

// argsSchema: JSON Schema (array of strings) of the arguments the user fills
// in when installing; they are appended to args.
export const mcpStdioRegistryConfigSchema = z.strictObject({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  argsSchema: z.record(z.string(), z.unknown()).optional(),
  timeout: z.number().int().min(1).optional(),
});

const registryItemBase = {
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  tags: z.array(z.string()),
};

export const mcpServerRegistryItemSchema = z.discriminatedUnion("transport", [
  z.object({ ...registryItemBase, transport: z.literal(McpTransport.HTTP), config: mcpHttpRegistryConfigSchema }),
  z.object({ ...registryItemBase, transport: z.literal(McpTransport.STDIO), config: mcpStdioRegistryConfigSchema }),
]);
export type McpServerRegistryItem = z.infer<typeof mcpServerRegistryItemSchema>;
