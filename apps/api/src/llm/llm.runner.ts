import { Injectable } from "@nestjs/common";

import { attemptReason, FailoverError, isFailover, LlmError } from "./errors.js";
import { LLMDriverRegistry, LLMRegistry } from "./llm.registry.js";
import { splitModelRef } from "./model-ref.js";

import type { JsonObject, LlmMessage, LlmPart, LlmResponse, LlmStreamEvent, LlmTool } from "@snipet/shared";
import type { ChatRequest } from "./driver.js";

export interface LlmTarget {
  model: string; // "llm/model"
  connection: JsonObject;
  extraOptions?: JsonObject;
}

export interface RunInput {
  targets: LlmTarget[];
  messages: LlmMessage[];
  tools?: LlmTool[];
  signal?: AbortSignal;
}

// Runs a conversation against an ordered list of targets, failing over to
// the next one on rate limit / auth / unavailable errors.
@Injectable()
export class LLMRunner {
  constructor(
    private readonly llms: LLMRegistry,
    private readonly drivers: LLMDriverRegistry,
  ) {}

  async generate({ targets, messages, tools, signal }: RunInput): Promise<LlmResponse> {
    if (targets.length === 0) throw new LlmError("bad_request", "no targets");
    const attempts: FailoverError["attempts"] = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      try {
        const { driver, request, options } = this.resolve(target, messages, tools, signal);
        return await driver.generate(request, options);
      } catch (err) {
        if (!isFailover(err)) throw err;
        attempts.push({ llm: target.model, error: err as LlmError });
      }
    }
    throw new FailoverError(attempts);
  }

  // Yields llm_skipped per target skipped, llm_started once one is chosen,
  // its events, then the assembled message. Failover only happens before a
  // target's first event; after that errors propagate.
  async *stream({ targets, messages, tools, signal }: RunInput): AsyncGenerator<LlmStreamEvent> {
    if (targets.length === 0) throw new LlmError("bad_request", "no targets");
    const attempts: FailoverError["attempts"] = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      let iterator: AsyncIterator<LlmStreamEvent>;
      let first: IteratorResult<LlmStreamEvent>;
      try {
        const { driver, request, options } = this.resolve(target, messages, tools, signal);
        iterator = driver.stream(request, options)[Symbol.asyncIterator]();
        first = await iterator.next();
      } catch (err) {
        if (!isFailover(err)) throw err;
        attempts.push({ llm: target.model, error: err as LlmError });
        yield { event: "llm_skipped", data: { llm: target.model, error: attemptReason(err as LlmError) } };
        continue;
      }

      yield { event: "llm_started", data: { llm: target.model } };
      let text = "";
      const toolCalls: LlmPart[] = [];
      for (let result = first; !result.done; result = await iterator.next()) {
        const event = result.value;
        if (event.event === "text_delta") text += event.data.text;
        if (event.event === "tool_call") toolCalls.push({ type: "tool_call", ...event.data });
        yield event;
      }
      const parts: LlmPart[] = text ? [{ type: "text", text }, ...toolCalls] : toolCalls;
      yield { event: "message", data: { message: { role: "assistant", parts } } };
      return;
    }
    throw new FailoverError(attempts);
  }

  // The target's chat driver with its options. Bad input is fatal, never a
  // failover.
  private resolve(target: LlmTarget, messages: LlmMessage[], tools: LlmTool[] | undefined, signal?: AbortSignal) {
    const [llmKey, model] = splitModelRef(target.model);
    const chat = this.drivers.resolve(this.llms.get(llmKey), "chat", target.connection);
    if (!chat) throw new LlmError("bad_request", `"${llmKey}" does not support chat`);
    const request: ChatRequest = { model, messages, tools, extraOptions: target.extraOptions, signal };
    return { driver: chat.driver, options: chat.options, request };
  }
}
