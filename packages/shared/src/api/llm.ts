import { z } from "zod";

// --- messages ------------------------------------------------------------

export const llmRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type LlmRole = z.infer<typeof llmRoleSchema>;

export const llmTextPartSchema = z.object({ type: z.literal("text"), text: z.string() });
// source: http(s) URL, data URI or bare base64.
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

// A tool offered to the model; parameters is the JSON Schema of its arguments.
export const llmToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()),
});
export type LlmTool = z.infer<typeof llmToolSchema>;

// --- providers and models ------------------------------------------------

// "static": the connection's `auth` section must satisfy `data` (a JSON Schema).
export const llmProviderAuthSchema = z.object({
  type: z.enum(["no-auth", "static"]),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type LlmProviderAuth = z.infer<typeof llmProviderAuthSchema>;

export const llmProviderInfoSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  tags: z.array(z.string()).optional(),
  auth: z.array(llmProviderAuthSchema),
  schemas: z.object({
    // Validates the connection's `config` section (endpoint, headers, ...).
    config: z.record(z.string(), z.unknown()).optional(),
    // Validates a target's `extraOptions` on execute.
    generateExtraOptions: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type LlmProviderInfo = z.infer<typeof llmProviderInfoSchema>;

export const llmCapabilitySchema = z.enum(["text", "vision", "tools", "streaming", "embedding"]);
export type LlmCapability = z.infer<typeof llmCapabilitySchema>;

export const llmModelSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(llmCapabilitySchema),
  // 0 = unknown.
  contextWindow: z.number(),
  maxOutputTokens: z.number().optional(),
});
export type LlmModel = z.infer<typeof llmModelSchema>;

// connectionId: stored connection to source options from; else the provider's default.
export const listProviderModelsParamsSchema = z.object({
  connectionId: z.uuid().optional(),
});
export type ListProviderModelsParams = z.infer<typeof listProviderModelsParamsSchema>;

// --- execute -------------------------------------------------------------

// A connection's options: { auth: {...}, config: {...} }.
export const llmConnectionOptionsSchema = z.object({
  auth: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type LlmConnectionOptions = z.infer<typeof llmConnectionOptionsSchema>;

// One model the runner may try, in order. model is "provider/model".
// connectionOptions is used as-is; else connectionId; else the provider's default connection.
export const executeLlmTargetSchema = z.object({
  model: z.string().min(1),
  connectionId: z.uuid().optional(),
  connectionOptions: llmConnectionOptionsSchema.optional(),
  extraOptions: z.record(z.string(), z.unknown()).optional(),
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
  // The runner committed to this target ("provider/model").
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
