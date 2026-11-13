import { z } from "zod";

import { jsonObjectSchema } from "../../../schemas/json.js";

// TOOLS ---------------------------------------------------------------------
/** A tool offered to the model; parameters is the JSON Schema of its arguments. */
export const llmToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: jsonObjectSchema,
});
export type LLMTool = z.infer<typeof llmToolSchema>;

export const llmToolCallRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
});
export type LLMToolCallRequest = z.infer<typeof llmToolCallRequestSchema>;

export const toolResultSchema = z.object({ content: z.string(), isError: z.boolean() });
export type LLMToolResult = z.infer<typeof toolResultSchema>;
