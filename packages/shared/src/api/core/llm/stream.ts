import z from "zod";

import { llmMessageSchema } from "./message.js";
import { llmUsageSchema } from "./response.js";
import { llmToolCallRequestSchema } from "./tool.js";

export enum LLMStreamEventType {
  LLM_STARTED = "llm_started",
  LLM_SKIPPED = "llm_skipped",
  TEXT_DELTA = "text_delta",
  THINKING_DELTA = "thinking_delta",
  USAGE = "usage",
  TOOL_CALL = "tool_call",
  MESSAGE = "message",
  ERROR = "error",
  DONE = "done",
}
export const llmStreamEventMetadataSchema = z.record(z.string(), z.unknown());
export type LLMStreamEventMetadata = z.infer<typeof llmStreamEventMetadataSchema>;

export const llmStreamEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal(LLMStreamEventType.LLM_STARTED),
    data: z.object({ metadata: llmStreamEventMetadataSchema, model: z.string() }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.LLM_SKIPPED),
    data: z.object({ metadata: llmStreamEventMetadataSchema, model: z.string(), error: z.string() }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.TEXT_DELTA),
    data: z.object({ text: z.string() }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.THINKING_DELTA),
    data: z.object({ text: z.string() }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.USAGE),
    data: z.object({ metadata: llmStreamEventMetadataSchema, usage: llmUsageSchema }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.TOOL_CALL),
    data: z.object({
      metadata: llmStreamEventMetadataSchema,
      call: llmToolCallRequestSchema,
    }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.MESSAGE),
    data: z.object({ metadata: llmStreamEventMetadataSchema, message: llmMessageSchema }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.ERROR),
    data: z.object({ metadata: llmStreamEventMetadataSchema, message: z.string() }),
  }),
  z.object({
    event: z.literal(LLMStreamEventType.DONE),
    data: z.object({}),
  }),
]);
export type LLMStreamEvent = z.infer<typeof llmStreamEventSchema>;
