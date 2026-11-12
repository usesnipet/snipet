import z from "zod";

import { llmToolCallRequestSchema } from "./tool.js";

// MESSAGE PARTS --------------------------------------------------------------
export const llmTextPartSchema = z.object({ type: z.literal("text"), text: z.string() });
export type LLMTextPart = z.infer<typeof llmTextPartSchema>;

/** The model's reasoning before its answer, from models that expose it. */
export const llmThinkingPartSchema = z.object({ type: z.literal("thinking"), text: z.string() });
export type LLMThinkingPart = z.infer<typeof llmThinkingPartSchema>;

/** source: http(s) URL, data URI or bare base64. */
export const llmImagePartSchema = z.object({ type: z.literal("image"), source: z.string(), mimeType: z.string() });
export type LLMImagePart = z.infer<typeof llmImagePartSchema>;

export const llmToolCallPartSchema = llmToolCallRequestSchema.extend({ type: z.literal("tool_call") });
export type LLMToolCallPart = z.infer<typeof llmToolCallPartSchema>;

export const llmToolResultPartSchema = z.object({
  type: z.literal("tool_result"),
  toolCallId: z.string(),
  content: z.string(),
  isError: z.boolean().optional(),
});
export type LLMToolResultPart = z.infer<typeof llmToolResultPartSchema>;

export const llmPartSchema = z.discriminatedUnion("type", [
  llmTextPartSchema,
  llmThinkingPartSchema,
  llmImagePartSchema,
  llmToolCallPartSchema,
  llmToolResultPartSchema,
]);
export type LLMPart = z.infer<typeof llmPartSchema>;

// MESSAGES ------------------------------------------------------------------
export enum LLMRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
}
export const llmRoleSchema = z.enum(LLMRole);

export const llmMessageSchema = z.object({
  role: llmRoleSchema,
  parts: z.array(llmPartSchema),
});
export type LLMMessage = z.infer<typeof llmMessageSchema>;
