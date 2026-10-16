import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../schemas/manifest.js";

// --- messages ------------------------------------------------------------

export const llmRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type LlmRole = z.infer<typeof llmRoleSchema>;

export const llmTextPartSchema = z.object({ type: z.literal("text"), text: z.string() });
/** source: http(s) URL, data URI or bare base64. */
export const llmImagePartSchema = z.object({ type: z.literal("image"), source: z.string(), mimeType: z.string() });
export const llmToolCallPartSchema = z.object({
  type: z.literal("tool_call"),
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
});
export const llmToolResultPartSchema = z.object({
  type: z.literal("tool_result"),
  toolCallId: z.string(),
  content: z.string(),
  isError: z.boolean().optional(),
});
export const llmPartSchema = z.discriminatedUnion("type", [
  llmTextPartSchema,
  llmImagePartSchema,
  llmToolCallPartSchema,
  llmToolResultPartSchema,
]);
export type LlmPart = z.infer<typeof llmPartSchema>;
export type LlmToolCallPart = z.infer<typeof llmToolCallPartSchema>;

export const llmMessageSchema = z.object({
  role: llmRoleSchema,
  parts: z.array(llmPartSchema),
});
export type LlmMessage = z.infer<typeof llmMessageSchema>;

/** A tool offered to the model; parameters is the JSON Schema of its arguments. */
export const llmToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()),
});
export type LlmTool = z.infer<typeof llmToolSchema>;

// --- llms and models ------------------------------------------------
export enum LlmCapability {
  TEXT = "text",
  VISION = "vision",
  TOOLS = "tools",
  EMBEDDING = "embedding",
}
export const llmCapabilitySchema = z.enum(LlmCapability);

/**
 * The JSON manifest of an LLM. Vision/tools are per model (see
 * LlmModel.capabilities), so text, vision and tools all go through `chat`.
 */
export const llmManifestSchema = baseManifestSchema.extend({
  models: driverSchema,
  chat: driverSchema.optional(), // generate + stream
  healthCheck: driverSchema.optional(),
});
export type LlmManifest = z.infer<typeof llmManifestSchema>;

export const llmModelSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(llmCapabilitySchema),
  contextWindow: z.number(), // 0 = unknown.
  maxOutputTokens: z.number().nullish(),
});
export type LlmModel = z.infer<typeof llmModelSchema>;

/** connectionId: the connection whose synced models to list; else the llm's default. */
export const listLLMModelsParamsSchema = z.object({
  connectionId: z.uuid().optional(),
});
export type ListLLMModelsParams = z.infer<typeof listLLMModelsParamsSchema>;

// --- execute -------------------------------------------------------------

/**
 * One model the runner may try, in order. model is "llm/model". Runs on
 * connectionId, else the llm's default connection.
 */
export const executeLlmTargetSchema = z.object({
  model: z.string().min(1),
  connectionId: z.uuid().optional(),
  extraOptions: jsonObjectSchema.optional(),
});
export type ExecuteLlmTarget = z.infer<typeof executeLlmTargetSchema>;

export const executeLlmSchema = z.object({
  targets: z.array(executeLlmTargetSchema).min(1),
  messages: z.array(llmMessageSchema).min(1),
  tools: z.array(llmToolSchema).optional(),
});
export type ExecuteLlm = z.infer<typeof executeLlmSchema>;

export const llmFinishReasonSchema = z.enum(["stop", "length", "tool_call"]);
export type LlmFinishReason = z.infer<typeof llmFinishReasonSchema>;

export const llmUsageSchema = z.object({ inputTokens: z.number(), outputTokens: z.number() });
export type LlmUsage = z.infer<typeof llmUsageSchema>;

export const llmResponseSchema = z.object({
  message: llmMessageSchema,
  finishReason: llmFinishReasonSchema,
  usage: llmUsageSchema,
});
export type LlmResponse = z.infer<typeof llmResponseSchema>;

// --- stream events (SSE `event:` name + `data:` payload) -----------------

export const llmStreamEventSchema = z.discriminatedUnion("event", [
  // The runner committed to this target ("llm/model").
  z.object({ event: z.literal("llm_started"), data: z.object({ llm: z.string() }) }),
  // A target skipped during failover (rate limit, auth, unavailable).
  z.object({ event: z.literal("llm_skipped"), data: z.object({ llm: z.string(), error: z.string() }) }),
  z.object({ event: z.literal("text_delta"), data: z.object({ text: z.string() }) }),
  z.object({
    event: z.literal("tool_call"),
    data: z.object({ id: z.string(), name: z.string(), arguments: z.unknown() }),
  }),
  // The full assistant message, once the stream ends cleanly.
  z.object({ event: z.literal("message"), data: z.object({ message: llmMessageSchema }) }),
  z.object({ event: z.literal("error"), data: z.object({ message: z.string() }) }),
  z.object({ event: z.literal("done"), data: z.object({}) }),
]);
export type LlmStreamEvent = z.infer<typeof llmStreamEventSchema>;
