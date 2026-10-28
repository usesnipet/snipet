import { Driver } from "#src/manifest/driver.js";

import { ollamaClient, ollamaOptionsSchema, toLlmError } from "./ollama.client.js";
import { fromChatResponse, toOllamaMessages, toOllamaTools, toStreamEvents } from "./ollama.mapper.js";

import type { LlmResponse } from "@snipet/shared";
import type { ChatRequest as OllamaChatRequest } from "ollama";
import type { ChatDriver, ChatRequest, ChatStreamEvent } from "../../driver.js";
import type { OllamaOptions } from "./ollama.client.js";

/**
 * Chat via Ollama's native /api/chat. extraOptions take its request fields
 * as is (think, format, keep_alive, options: { num_ctx, temperature, ... });
 * `options` is merged over the manifest's.
 */
export class OllamaChatDriver extends Driver(ollamaOptionsSchema) implements ChatDriver<OllamaOptions> {
  readonly key = "ollama";

  async generate(req: ChatRequest, options: OllamaOptions): Promise<LlmResponse> {
    try {
      const res = await ollamaClient(options, req.signal).chat({ ...body(req, options), stream: false });
      return fromChatResponse(res);
    } catch (err) {
      throw toLlmError(err);
    }
  }

  async *stream(req: ChatRequest, options: OllamaOptions): AsyncGenerator<ChatStreamEvent> {
    try {
      const chunks = await ollamaClient(options, req.signal).chat({ ...body(req, options), stream: true });
      yield* toStreamEvents(chunks);
    } catch (err) {
      throw toLlmError(err);
    }
  }
}

function body(req: ChatRequest, { keepAlive, think, options }: OllamaOptions): OllamaChatRequest {
  const extra = (req.extraOptions ?? {}) as Partial<OllamaChatRequest>;
  return {
    keep_alive: keepAlive,
    think,
    ...extra,
    options: { ...options, ...extra.options },
    model: req.model,
    messages: toOllamaMessages(req.messages),
    tools: toOllamaTools(req.tools),
  };
}
