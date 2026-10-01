import type {
  LlmConnectionOptions,
  LlmMessage,
  LlmModel,
  LlmProviderInfo,
  LlmResponse,
  LlmStreamEvent,
  LlmTool,
} from "@snipet/shared";

export interface GenerateRequest {
  model: string; // provider's own model key, e.g. "gpt-4o"
  messages: LlmMessage[];
  tools?: LlmTool[];
  extraOptions?: Record<string, unknown>; // validated against info.schemas.generateExtraOptions
  connectionOptions: LlmConnectionOptions;
  signal?: AbortSignal;
}

// Events a provider stream yields; the runner adds llm_started/llm_skipped/message.
export type ProviderStreamEvent = Extract<LlmStreamEvent, { event: "text_delta" | "tool_call" }>;

// A provider driver. Only info + models are required; generate/stream/healthCheck
// are optional capabilities (a provider must have generate or stream).
// Errors thrown should be LlmError so the runner can decide failover.
export interface LlmProvider {
  readonly info: LlmProviderInfo;
  models(connectionOptions: LlmConnectionOptions): Promise<LlmModel[]>;
  healthCheck?(connectionOptions: LlmConnectionOptions): Promise<void>;
  generate?(req: GenerateRequest): Promise<LlmResponse>;
  stream?(req: GenerateRequest): AsyncIterable<ProviderStreamEvent>;
}
