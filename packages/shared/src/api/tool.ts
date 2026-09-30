import { z } from "zod";

import { mcpServerSchema } from "./mcp-server.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

// Where a tool comes from.
export enum ToolSource {
  MCP = "mcp",
  NATIVE = "native",
}
export const toolSourceSchema = z.enum(ToolSource);

// Tools are not created by clients: MCP tools are synced from what each
// server advertises.
export const toolSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
  source: toolSourceSchema,
  mcpServerId: z.uuid().nullable(),
  mcpServer: mcpServerSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Tool = z.infer<typeof toolSchema>;

export const paginatedToolSchema = paginatedSchema(toolSchema);

export const findToolsParamsSchema = paginationParamsSchema.extend({
  // Matches the name, case-insensitive.
  search: z.string().trim().max(255).optional(),
  source: toolSourceSchema.optional(),
  mcpServerId: z.uuid().optional(),
});
export type FindToolsParams = z.infer<typeof findToolsParamsSchema>;

// arguments must match the tool's inputSchema.
export const executeToolSchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
});
export type ExecuteTool = z.infer<typeof executeToolSchema>;

// The outcome of a tool run, in the shape a model consumes. isError marks a
// failure the model should see and may recover from, like invalid arguments
// or an unreachable server.
export const toolResultSchema = z.object({
  content: z.string(),
  isError: z.boolean(),
});
export type ToolResult = z.infer<typeof toolResultSchema>;
