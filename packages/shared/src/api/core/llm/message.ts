import { z } from "zod";

import { llmToolCallRequestSchema } from "./tool.js";

export enum LLMMessagePartType {
  TEXT = "text",
  THINKING = "thinking",
  IMAGE = "image",
  TOOL_CALL = "tool_call",
  TOOL_RESULT = "tool_result",
}
// MESSAGE PARTS --------------------------------------------------------------
export const llmTextPartSchema = z.object({ type: z.literal(LLMMessagePartType.TEXT), text: z.string() });
export type LLMMessageTextPart = z.infer<typeof llmTextPartSchema>;

/** The model's reasoning before its answer, from models that expose it. */
export const llmThinkingPartSchema = z.object({ type: z.literal(LLMMessagePartType.THINKING), text: z.string() });
export type LLMMessageThinkingPart = z.infer<typeof llmThinkingPartSchema>;

/** source: http(s) URL, data URI or bare base64. */
export const llmImagePartSchema = z.object({
  type: z.literal(LLMMessagePartType.IMAGE),
  source: z.string(),
  mimeType: z.string(),
});
export type LLMMessageImagePart = z.infer<typeof llmImagePartSchema>;

export const llmToolCallPartSchema = llmToolCallRequestSchema.extend({ type: z.literal(LLMMessagePartType.TOOL_CALL) });
export type LLMMessageToolCallPart = z.infer<typeof llmToolCallPartSchema>;

export const llmToolResultPartSchema = z.object({
  type: z.literal(LLMMessagePartType.TOOL_RESULT),
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
export type LLMMessagePart = z.infer<typeof llmPartSchema>;

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
