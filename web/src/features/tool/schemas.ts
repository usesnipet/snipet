import { toolSchema } from "@/models/tool";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

export { toolSchema } from "@/models/tool";
export type { Tool } from "@/models/tool";

export const paginatedToolSchema = paginatedSchema(toolSchema);
export type PaginatedTool = z.infer<typeof paginatedToolSchema>;

export const listToolsSearchParamsSchema = paginationParamsSchema;
export type ListToolsSearchParams = z.infer<
  typeof listToolsSearchParamsSchema
>;
