import { z } from "zod";

// Transport an MCP server is reached over (mcp.Transport).
export const mcpTransportSchema = z.enum(["http", "stdio"]);
export type McpTransport = z.infer<typeof mcpTransportSchema>;

// Config for the "http" transport.
export const mcpHttpConfigSchema = z.object({
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().positive().optional(),
}).strict();
export type McpHttpConfig = z.infer<typeof mcpHttpConfigSchema>;

// Config for the "stdio" transport.
export const mcpStdioConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
}).strict();
export type McpStdioConfig = z.infer<typeof mcpStdioConfigSchema>;

// Config of an installed server, shaped by its transport (mcp.HTTPConfig / mcp.StdioConfig).
export const mcpServerConfigSchema = z.union([mcpHttpConfigSchema, mcpStdioConfigSchema]);
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

// The McpServer entity — the read model as it comes off the API.
// Relations to other entities go here (import them from "@/models/<other>"),
// never from another feature's schemas. DTOs live in the feature's schemas.ts.
export const mcpServerSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    transport: mcpTransportSchema,
    config: mcpServerConfigSchema,
    last_synced_at: z.coerce.date().nullish(),
    last_synced_error: z.string().optional(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();

export type McpServer = z.infer<typeof mcpServerSchema>;
