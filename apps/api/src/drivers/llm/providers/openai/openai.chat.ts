import { Driver } from "#src/core/manifest/driver.js";

import { openAiClient, openAiOptionsSchema, toLlmError } from "./openai.client.js";
import { fromCompletion, toOpenAiMessages, toOpenAiTools, toStreamEvents } from "./openai.mapper.js";

import type { LLMResponse } from "@snipet/shared/core";
import type { ChatDriver, ChatRequest, ChatStreamEvent } from "#src/core/llm/driver.js";
import type { OpenAiOptions } from "./openai.client.js";

/** Chat Completions via the official SDK. */
export class OpenAiChatDriver extends Driver(openAiOptionsSchema) implements ChatDriver<OpenAiOptions> {
  readonly key = "openai";

  async generate(req: ChatRequest, options: OpenAiOptions): Promise<LLMResponse> {
    try {
      const completion = await openAiClient(options).chat.completions.create(
        { temperature: options.temperature, ...body(req), stream: false },
        { signal: req.signal },
      );
      return fromCompletion(completion);
    } catch (err) {
      throw toLlmError(err);
    }
  }

  async *stream(req: ChatRequest, options: OpenAiOptions): AsyncGenerator<ChatStreamEvent> {
    try {
      const chunks = await openAiClient(options).chat.completions.create(
        {
          temperature: options.temperature,
          ...body(req),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: req.signal },
      );
      yield* toStreamEvents(chunks);
    } catch (err) {
      throw toLlmError(err);
    }
  }
}

function body(req: ChatRequest) {
  return { model: req.model, messages: toOpenAiMessages(req.messages), tools: toOpenAiTools(req.tools) };
}
