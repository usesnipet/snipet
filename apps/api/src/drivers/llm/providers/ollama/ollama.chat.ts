import { Driver } from "#src/core/manifest/driver.js";

import { ollamaClient, ollamaOptionsSchema, toLlmError } from "./ollama.client.js";
import { fromChatResponse, toOllamaMessages, toOllamaTools, toStreamEvents } from "./ollama.mapper.js";

import type { LlmResponse } from "@snipet/shared";
import type { ChatRequest as OllamaChatRequest } from "ollama";
import type { ChatDriver, ChatRequest, ChatStreamEvent } from "#src/core/llm/driver.js";
import type { OllamaOptions } from "./ollama.client.js";

/** Chat via Ollama's native /api/chat. */
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
  return {
    keep_alive: keepAlive,
    think,
    options,
    model: req.model,
    messages: toOllamaMessages(req.messages),
    tools: toOllamaTools(req.tools),
  };
}
