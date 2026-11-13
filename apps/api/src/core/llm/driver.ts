import type { BaseDriver } from "#src/core/manifest/driver.js";
import type { HealthCheckDriver } from "#src/core/manifest/health-check.js";
import type { LLMMessage, LLMModel, LLMResponse, LLMStreamEvent, LLMTool } from "@snipet/shared/core";

export interface ModelDriver<Opts = unknown> extends BaseDriver<Opts> {
  listModels(options: Opts): Promise<LLMModel[]>;
}

export interface ChatRequest {
  model: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  signal?: AbortSignal;
}

export type ChatStreamEvent = Extract<
  LLMStreamEvent,
  { event: "text_delta" | "thinking_delta" | "tool_call" | "usage" }
>;

export interface ChatDriver<Opts = unknown> extends BaseDriver<Opts> {
  generate(req: ChatRequest, options: Opts): Promise<LLMResponse>;
  stream(req: ChatRequest, options: Opts): AsyncGenerator<ChatStreamEvent>;
}

/** Driver per capability, keyed by the manifest field that names it. */
export type LLMDrivers = {
  models: ModelDriver;
  chat: ChatDriver;
  healthCheck: HealthCheckDriver;
};
