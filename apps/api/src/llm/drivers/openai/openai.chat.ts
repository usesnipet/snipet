import { Driver } from "#src/manifest/driver.js";

import { openAiClient, openAiOptionsSchema, toLlmError } from "./openai.client.js";
import { fromCompletion, toOpenAiMessages, toOpenAiTools, toStreamEvents } from "./openai.mapper.js";

import type { LlmResponse } from "@snipet/shared";
import type { ChatDriver, ChatRequest, ChatStreamEvent } from "../../driver.js";
import type { OpenAiOptions } from "./openai.client.js";

/**
 * Chat Completions via the official SDK. extraOptions (temperature, ...) are
 * passed through to the request as is.
 */
export class OpenAiChatDriver extends Driver(openAiOptionsSchema) implements ChatDriver<OpenAiOptions> {
  readonly key = "openai";

  async generate(req: ChatRequest, options: OpenAiOptions): Promise<LlmResponse> {
    try {
      const completion = await openAiClient(options).chat.completions.create(
        { temperature: options.temperature, ...req.extraOptions, ...body(req), stream: false },
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
          ...req.extraOptions,
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
