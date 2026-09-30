import { mcpTransportSchema, McpTransport } from "@snipet/shared";
import { z } from "zod";

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
    if (values.transport === McpTransport.STDIO && !values.commandLine.trim()) {
      ctx.addIssue({ code: "custom", path: ["commandLine"], message: "Command is required" });
    }
    if (values.transport === McpTransport.HTTP && !z.url().safeParse(values.url.trim()).success) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid URL" });
    }
  });
export type McpServerForm = z.infer<typeof mcpServerFormSchema>;
