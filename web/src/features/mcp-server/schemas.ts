import {
  mcpHttpConfigSchema, mcpServerSchema, mcpStdioConfigSchema, mcpTransportSchema
} from "@/models/mcp-server";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

export {
  mcpHttpConfigSchema,
  mcpServerConfigSchema,
  mcpServerSchema,
  mcpStdioConfigSchema,
  mcpTransportSchema,
} from "@/models/mcp-server";
export type {
  McpHttpConfig,
  McpServer,
  McpServerConfig,
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

// Default http config of a registry entry (mcp.HTTPRegistryConfig):
// headers_schema is a JSON Schema of the headers the user fills in at install time.
export const mcpHttpRegistryConfigSchema = mcpHttpConfigSchema
  .extend({ headers_schema: z.record(z.string(), z.unknown()).optional() })
  .strict();
export type McpHttpRegistryConfig = z.infer<typeof mcpHttpRegistryConfigSchema>;

const mcpServerRegistryItemBaseSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    tags: z.array(z.string()),
  })
  .strict();

// Registry entry — a known MCP server with its default config
// (mcp.MCPServersRegistryItem), as returned by GET /api/mcp-server/registry.
// No id and no relations, so it stays here rather than in @/models.
export const mcpServerRegistryItemSchema = z.discriminatedUnion("transport", [
  mcpServerRegistryItemBaseSchema.extend({
    transport: z.literal("http"),
    config: mcpHttpRegistryConfigSchema,
  }),
  mcpServerRegistryItemBaseSchema.extend({
    transport: z.literal("stdio"),
    config: mcpStdioConfigSchema,
  }),
]);
export type McpServerRegistryItem = z.infer<typeof mcpServerRegistryItemSchema>;

export const listMcpServerRegistrySchema = z.array(mcpServerRegistryItemSchema);
export type ListMcpServerRegistry = z.infer<typeof listMcpServerRegistrySchema>;

// Form shape behind the create/edit/install dialogs. The stdio command is
// edited as one shell-like line and headers as rows; lib/config.ts converts
// it to and from CreateMcpServer.
export const mcpServerFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255),
    transport: mcpTransportSchema,
    commandLine: z.string(),
    url: z.string(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })),
    timeout: z.string().regex(/^\d*$/, "Use a whole number of seconds"),
  })
  .superRefine((values, ctx) => {
    if (values.transport === "stdio" && !values.commandLine.trim()) {
      ctx.addIssue({ code: "custom", path: ["commandLine"], message: "Command is required" });
    }
    if (values.transport === "http" && !z.url().safeParse(values.url.trim()).success) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid URL" });
    }
  });
export type McpServerForm = z.infer<typeof mcpServerFormSchema>;
