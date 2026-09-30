import { toolSchema, toolSourceSchema } from "@/models/tool";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

export { toolSchema } from "@/models/tool";
export type { Tool, ToolSource } from "@/models/tool";

export const paginatedToolSchema = paginatedSchema(toolSchema);
export type PaginatedTool = z.infer<typeof paginatedToolSchema>;

export const listToolsSearchParamsSchema = paginationParamsSchema
  .extend({
    search: z.string().max(255).optional(),
    source: toolSourceSchema.optional(),
    mcp_server_id: z.uuid().optional(),
  })
  .strict();
export type ListToolsSearchParams = z.infer<
  typeof listToolsSearchParamsSchema
>;

export const executeToolSchema = z.object({
  arguments: z.record(z.string(), z.unknown()),
});
export type ExecuteTool = z.infer<typeof executeToolSchema>;

// is_error marks a failure the tool reported (bad arguments, server error),
// as opposed to a failed request.
export const executeToolResponseSchema = z.object({
  content: z.string(),
  is_error: z.boolean(),
});
export type ExecuteToolResponse = z.infer<typeof executeToolResponseSchema>;
