import { z } from "zod";

import { llmMessageSchema } from "./message.js";

export enum LLMFinishReason {
  STOP = "stop",
  LENGTH = "length",
  TOOL_CALL = "tool_call",
}
export const llmFinishReasonSchema = z.enum(LLMFinishReason);

export const llmUsageSchema = z.object({
  /** Every prompt token, the cached ones included. */
  inputTokens: z.number(),
  outputTokens: z.number(),
  /** The part of inputTokens read from the provider's prompt cache; absent when the provider doesn't report it. */
  cachedInputTokens: z.number().optional(),
});
export type LLMUsage = z.infer<typeof llmUsageSchema>;

export const llmResponseSchema = z.object({
  message: llmMessageSchema,
  finishReason: llmFinishReasonSchema,
  usage: llmUsageSchema,
});
export type LLMResponse = z.infer<typeof llmResponseSchema>;
