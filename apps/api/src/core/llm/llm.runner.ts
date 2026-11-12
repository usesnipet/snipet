import {
  LLMMessage,
  LLMMessagePart,
  LLMMessagePartType,
  LLMResponse,
  LLMRole,
  LLMStreamEvent,
  LLMStreamEventType,
  LLMTarget,
  LLMTool,
} from "@snipet/shared/core";

import { FailoverError, LLMError, LLMErrorCode } from "./errors.js";
import { LLMDriverRegistry, LLMManifestRegistry } from "./llm.registry.js";

import type { ChatRequest } from "./driver.js";

export interface RunInput {
  targets: LLMTarget[];
  messages: LLMMessage[];
  tools?: LLMTool[];
  signal?: AbortSignal;
}

/**
 * Runs a conversation against an ordered list of targets, failing over to
 * the next one on any LLMError.
 */
export class LLMRunner {
  constructor(
    private readonly llmManifestsRegistry: LLMManifestRegistry,
    private readonly llmDriversRegistry: LLMDriverRegistry,
  ) {}

  async generate({ targets, messages, tools, signal }: RunInput): Promise<LLMResponse> {
    if (targets.length === 0) throw new LLMError(LLMErrorCode.BAD_REQUEST, "no targets");
    const attempts: FailoverError["attempts"] = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      try {
        const { driver, request, options } = this.resolve(target, messages, tools, signal);
        return await driver.generate(request, options);
      } catch (error) {
        if (!(error instanceof LLMError)) throw error;
        attempts.push({ model: target.model, error });
      }
    }
    throw new FailoverError(attempts);
  }

  /**
   * Yields llm_skipped per target skipped, llm_started once one is chosen,
   * its events, then the assembled message. Failover only happens before a
   * target's first event; after that errors propagate.
   */
  async *stream({ targets, messages, tools, signal }: RunInput): AsyncGenerator<LLMStreamEvent> {
    if (targets.length === 0) throw new LLMError(LLMErrorCode.BAD_REQUEST, "no targets");
    const attempts: FailoverError["attempts"] = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      let iterator: AsyncIterator<LLMStreamEvent>;
      let first: IteratorResult<LLMStreamEvent>;
      try {
        const { driver, request, options } = this.resolve(target, messages, tools, signal);
        iterator = driver.stream(request, options)[Symbol.asyncIterator]();
        first = await iterator.next();
      } catch (error) {
        const { model } = target;
        if (!(error instanceof LLMError)) throw error;
        attempts.push({ model, error });
        yield { event: LLMStreamEventType.LLM_SKIPPED, data: { model, error: error.message } };
        continue;
      }

      yield { event: LLMStreamEventType.LLM_STARTED, data: { model: target.model } };
      let text = "";
      let thinking = "";
      const toolCalls: LLMMessagePart[] = [];
      try {
        for (let result = first; !result.done; result = await iterator.next()) {
          const event = result.value;
          if (event.event === LLMStreamEventType.TEXT_DELTA) text += event.data.text;
          if (event.event === LLMStreamEventType.THINKING_DELTA) thinking += event.data.text;
          if (event.event === LLMStreamEventType.TOOL_CALL)
            toolCalls.push({ type: LLMMessagePartType.TOOL_CALL, ...event.data.call });
          yield event;
        }
      } finally {
        // Closes the driver's stream when the consumer stops early, so the provider connection doesn't leak.
        await iterator.return?.();
      }
      const parts: LLMMessagePart[] = [];
      if (thinking) parts.push({ type: LLMMessagePartType.THINKING, text: thinking });
      if (text) parts.push({ type: LLMMessagePartType.TEXT, text });
      parts.push(...toolCalls);
      yield { event: LLMStreamEventType.MESSAGE, data: { message: { role: LLMRole.ASSISTANT, parts } } };
      return;
    }
    throw new FailoverError(attempts);
  }

  /**
   * The target's chat driver with its options. Throws an LLMError, so the
   * caller fails over, when the target can't be used.
   */
  private resolve(target: LLMTarget, messages: LLMMessage[], tools: LLMTool[] | undefined, signal?: AbortSignal) {
    if ("error" in target) throw new LLMError(LLMErrorCode.BAD_REQUEST, target.error);
    const llmManifest = this.llmManifestsRegistry.find(target.llm);
    if (!llmManifest) throw new LLMError(LLMErrorCode.LLM_NOT_FOUND, `llm "${target.llm}" not found`);
    const chat = this.llmDriversRegistry.resolve(llmManifest, "chat", target.connection);
    if (!chat) throw new LLMError(LLMErrorCode.BAD_REQUEST, `"${target.llm}" does not support chat`);

    const request: ChatRequest = { model: target.model, messages, tools, signal };
    return { driver: chat.driver, options: chat.options, request };
  }
}
