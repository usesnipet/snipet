import type { BaseDriver } from "#src/manifest/driver.js";
import type { HealthCheckDriver } from "#src/manifest/health-check.js";
import type { LlmMessage, LlmModel, LlmResponse, LlmStreamEvent, LlmTool } from "@snipet/shared";

export interface ModelDriver<Opts = unknown> extends BaseDriver<Opts> {
  listModels(options: Opts): Promise<LlmModel[]>;
}

export interface ChatRequest {
  model: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  extraOptions?: Record<string, unknown>;
  signal?: AbortSignal;
}

export type ChatStreamEvent = Extract<LlmStreamEvent, { event: "text_delta" | "tool_call" }>;

export interface ChatDriver<Opts = unknown> extends BaseDriver<Opts> {
  generate(req: ChatRequest, options: Opts): Promise<LlmResponse>;
  stream(req: ChatRequest, options: Opts): AsyncGenerator<ChatStreamEvent>;
}

/** Driver per capability, keyed by the manifest field that names it. */
export type LLMDrivers = {
  models: ModelDriver;
  chat: ChatDriver;
  healthCheck: HealthCheckDriver;
};
