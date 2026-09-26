import { z } from "zod";

// llm.Message and its parts, as the API serialises them.
export const llmRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type LlmRole = z.infer<typeof llmRoleSchema>;

export const llmTextPartSchema = z.object({ type: z.literal("text"), text: z.string() }).strict();
export const llmImagePartSchema = z
  .object({ type: z.literal("image"), source: z.string(), mime_type: z.string() })
  .strict();
export const llmToolCallPartSchema = z
  .object({ type: z.literal("tool_call"), id: z.string(), name: z.string(), arguments: z.unknown() })
  .strict();
export const llmToolResultPartSchema = z
  .object({
    type: z.literal("tool_result"),
    tool_call_id: z.string(),
    content: z.string(),
    is_error: z.boolean(),
  })
  .strict();

// llm.Part — a message part, discriminated by "type".
export const llmPartSchema = z.discriminatedUnion("type", [
  llmTextPartSchema,
  llmImagePartSchema,
  llmToolCallPartSchema,
  llmToolResultPartSchema,
]);
export type LlmPart = z.infer<typeof llmPartSchema>;

export const llmMessageSchema = z
  .object({ role: llmRoleSchema, parts: z.array(llmPartSchema) })
  .strict();
export type LlmMessage = z.infer<typeof llmMessageSchema>;
