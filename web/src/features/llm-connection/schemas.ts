import { llmConnectionSchema } from "@/models/llm-connection";
import { llmMessageSchema } from "@/models/llm-message";
import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";
import { z } from "zod";

export { llmConnectionSchema } from "@/models/llm-connection";
export type { LlmConnection } from "@/models/llm-connection";
export type { LlmMessage, LlmRole } from "@/models/llm-message";

export const createLlmConnectionSchema = llmConnectionSchema
  .pick({
    name: true,
    provider: true,
    config: true,
    enabled: true,
  })
  .strict();
export type CreateLlmConnection = z.infer<typeof createLlmConnectionSchema>;

export const updateLlmConnectionSchema = createLlmConnectionSchema.partial().strict();
export type UpdateLlmConnection = z.infer<typeof updateLlmConnectionSchema>;

export const paginatedLlmConnectionSchema = paginatedSchema(llmConnectionSchema);
export type PaginatedLlmConnection = z.infer<typeof paginatedLlmConnectionSchema>;

export const listLlmConnectionsSearchParamsSchema = paginationParamsSchema;
export type ListLlmConnectionsSearchParams = z.infer<
  typeof listLlmConnectionsSearchParamsSchema
>;

// One auth method a provider accepts (llm.Auth). "static" carries the JSON
// Schema its "auth" connection-options section must satisfy; "no-auth" needs
// no data at all.
export const llmProviderAuthSchema = z
  .object({
    type: z.enum(["no-auth", "static"]),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type LlmProviderAuth = z.infer<typeof llmProviderAuthSchema>;

// The JSON Schemas a provider declares (llm.Schemas): `config` validates the
// always-required "config" connection-options section (e.g. a base URL);
// `generate_extra_options` validates the per-call options of both execute and
// execute/stream, and isn't part of this connection form.
export const llmProviderSchemasSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).nullish(),
    generate_extra_options: z.record(z.string(), z.unknown()).nullish(),
  })
  .strict();
export type LlmProviderSchemas = z.infer<typeof llmProviderSchemasSchema>;

// Provider entry — the provider drivers available on the backend (llm.Info),
// as returned by GET /api/llm-connection/providers. No id and no relations, so it
// stays here rather than in @/models.
export const llmProviderSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    tags: z.array(z.string()).optional(),
    auth: z.array(llmProviderAuthSchema),
    schemas: llmProviderSchemasSchema,
  })
  .strict();
export type LlmProvider = z.infer<
  typeof llmProviderSchema
>;

export const listLlmProviderSchema = z.array(llmProviderSchema);
export type ListLlmProvider = z.infer<typeof listLlmProviderSchema>;

// One feature a model supports (llm.Capability).
export const llmModelCapabilitySchema = z.enum(["text", "vision", "tools", "streaming", "embedding"]);
export type LlmModelCapability = z.infer<typeof llmModelCapabilitySchema>;

// One entry of a provider's model catalog (llm.Model), as returned by
// GET /api/llm-connection/providers/{key}/models.
export const providerModelSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    capabilities: z.array(llmModelCapabilitySchema),
    context_window: z.number(),
    max_output_tokens: z.number().optional(),
  })
  .strict();
export type ProviderModel = z.infer<typeof providerModelSchema>;

export const listProviderModelsSchema = z.array(providerModelSchema);
export type ListProviderModels = z.infer<typeof listProviderModelsSchema>;

// connection_id, when set, names the stored connection to source connection
// options from; otherwise the provider's default connection is used.
export const listProviderModelsSearchParamsSchema = z
  .object({
    connection_id: z.string().optional(),
  })
  .strict();
export type ListProviderModelsSearchParams = z.infer<
  typeof listProviderModelsSearchParamsSchema
>;

// --- Playground: execute / stream (llm.Message, llm.Part, llm.Response) ---

// One llm.Target the Runner may try, in order (failover on the first that fails).
export const executeLlmTargetSchema = z
  .object({
    model: z.string().min(1),
    connection_id: z.string().optional(),
    connection_options: z.record(z.string(), z.unknown()).optional(),
    extra_options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type ExecuteLlmTarget = z.infer<typeof executeLlmTargetSchema>;

// Body of both POST /execute and POST /execute/stream.
export const executeLlmSchema = z
  .object({
    targets: z.array(executeLlmTargetSchema).min(1),
    messages: z.array(llmMessageSchema).min(1),
  })
  .strict();
export type ExecuteLlm = z.infer<typeof executeLlmSchema>;

export const llmFinishReasonSchema = z.enum(["stop", "length", "tool_call"]);
export type LlmFinishReason = z.infer<typeof llmFinishReasonSchema>;

export const llmUsageSchema = z
  .object({ input_tokens: z.number(), output_tokens: z.number() })
  .strict();
export type LlmUsage = z.infer<typeof llmUsageSchema>;

// Response of the non-streaming POST /execute.
export const executeLlmResponseSchema = z
  .object({
    message: llmMessageSchema,
    finish_reason: llmFinishReasonSchema,
    usage: llmUsageSchema,
  })
  .strict();
export type ExecuteLlmResponse = z.infer<typeof executeLlmResponseSchema>;

// --- SSE event payloads
// Wire events are "llm_started" | "text_delta" | "tool_call" | "llm_skipped" | "message" | "error" | "done"
export const llmStartEventSchema = z.object({ llm: z.string() }).strict();
export type LlmStartEvent = z.infer<typeof llmStartEventSchema>;

export const llmTextDeltaEventSchema = z.object({ text: z.string() }).strict();
export type LlmTextDeltaEvent = z.infer<typeof llmTextDeltaEventSchema>;

export const llmToolCallEventSchema = z
  .object({ id: z.string(), name: z.string(), arguments: z.unknown() })
  .strict();
export type LlmToolCallEvent = z.infer<typeof llmToolCallEventSchema>;

// Emitted for a target skipped over during failover, e.g. a rate limit,
// auth failure, or connection problem.
export const llmSkippedEventSchema = z.object({ llm: z.string(), error: z.string() }).strict();
export type LlmSkippedEvent = z.infer<typeof llmSkippedEventSchema>;

// The full assistant message assembled from the stream's text and tool-call
// events, emitted once after the stream ends cleanly.
export const llmMessageEventSchema = z.object({ message: llmMessageSchema }).strict();
export type LlmMessageEvent = z.infer<typeof llmMessageEventSchema>;

export const llmStreamErrorEventSchema = z.object({ message: z.string() }).strict();
export type LlmStreamErrorEvent = z.infer<typeof llmStreamErrorEventSchema>;

export const llmStreamDoneEventSchema = z.object({}).strict();
export type LlmStreamDoneEvent = z.infer<typeof llmStreamDoneEventSchema>;

export const llmStreamEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("llm_started"), data: llmStartEventSchema }).strict(),
  z.object({ event: z.literal("text_delta"), data: llmTextDeltaEventSchema }).strict(),
  z.object({ event: z.literal("tool_call"), data: llmToolCallEventSchema }).strict(),
  z.object({ event: z.literal("llm_skipped"), data: llmSkippedEventSchema }).strict(),
  z.object({ event: z.literal("message"), data: llmMessageEventSchema }).strict(),
  z.object({ event: z.literal("error"), data: llmStreamErrorEventSchema }).strict(),
  z.object({ event: z.literal("done"), data: llmStreamDoneEventSchema }).strict(),
]);
export type LlmStreamEvent = z.infer<typeof llmStreamEventSchema>;
