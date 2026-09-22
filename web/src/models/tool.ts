import { z } from "zod";

// The Tool entity — the read model as it comes off the API.
// Relations to other entities go here (import them from "@/models/<other>"),
// never from another feature's schemas. DTOs live in the feature's schemas.ts.
export const toolSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string(),
    input_schema: z.record(z.string(), z.unknown()),
    source: z.string(),
    mcp_server_id: z.uuid().optional(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();

export type Tool = z.infer<typeof toolSchema>;
