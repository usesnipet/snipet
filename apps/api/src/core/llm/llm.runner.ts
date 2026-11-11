import { FailoverError, isFailover, LLMError, LLMErrorCode } from "./errors.js";
import { LLMDriverRegistry, LLMManifestRegistry } from "./llm.registry.js";

import type { JsonObject, LlmMessage, LlmPart, LlmResponse, LlmStreamEvent, LlmTool } from "@snipet/shared";
import type { ChatRequest } from "./driver.js";

/** A model of an llm the runner may try. */
interface TargetRef {
  /** The llm manifest's key, e.g. "openai". */
  llm: string;
  /** The model's key within the llm, e.g. "gpt-4o"; it may itself contain "/". */
  model: string;
}

/**
 * Where a conversation can run: a model with the connection to reach it, or
 * with why it can't be reached (its connection or model is gone). The runner
 * treats the error as if the target had failed with it, so a failover code
 * skips to the next target.
 */
export type LLMTarget =
  | (TargetRef & {
      /** The connection's config, rendered into the driver's options. */
      connection: JsonObject;
    })
  | (TargetRef & { error: LLMError });

/** The target as clients see it in events and errors: "llm/model". */
const label = (target: LLMTarget) => `${target.llm}/${target.model}`;

export interface RunInput {
  targets: LLMTarget[];
  messages: LlmMessage[];
  tools?: LlmTool[];
  signal?: AbortSignal;
}

/**
 * Runs a conversation against an ordered list of targets, failing over to
 * the next one when a target fails on its own (see FAILOVER in errors.ts).
 */
export class LLMRunner {
  constructor(
    private readonly llmManifestsRegistry: LLMManifestRegistry,
    private readonly llmDriversRegistry: LLMDriverRegistry,
  ) {}

  async generate({ targets, messages, tools, signal }: RunInput): Promise<LlmResponse> {
    if (targets.length === 0) throw new LLMError(LLMErrorCode.BAD_REQUEST, "no targets");
    const attempts: FailoverError["attempts"] = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      try {
        const { driver, request, options } = this.resolve(target, messages, tools, signal);
        return await driver.generate(request, options);
      } catch (err) {
        if (!isFailover(err)) throw err;
        attempts.push({ llm: label(target), error: err });
      }
    }
    throw new FailoverError(attempts);
  }

  /**
   * Yields llm_skipped per target skipped, llm_started once one is chosen,
   * its events, then the assembled message. Failover only happens before a
   * target's first event; after that errors propagate.
   */
  async *stream({ targets, messages, tools, signal }: RunInput): AsyncGenerator<LlmStreamEvent> {
    if (targets.length === 0) throw new LLMError(LLMErrorCode.BAD_REQUEST, "no targets");
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
        attempts.push({ llm: label(target), error: err });
        yield { event: "llm_skipped", data: { llm: label(target), error: err.message } };
        continue;
      }

      yield { event: "llm_started", data: { llm: label(target) } };
      let text = "";
      let thinking = "";
      const toolCalls: LlmPart[] = [];
      for (let result = first; !result.done; result = await iterator.next()) {
        const event = result.value;
        if (event.event === "text_delta") text += event.data.text;
        if (event.event === "thinking_delta") thinking += event.data.text;
        if (event.event === "tool_call") toolCalls.push({ type: "tool_call", ...event.data });
        yield event;
      }
      const parts: LlmPart[] = [
        ...(thinking ? [{ type: "thinking" as const, text: thinking }] : []),
        ...(text ? [{ type: "text" as const, text }] : []),
        ...toolCalls,
      ];
      yield { event: "message", data: { message: { role: "assistant", parts } } };
      return;
    }
    throw new FailoverError(attempts);
  }

  /**
   * The target's chat driver with its options. A missing llm fails over;
   * other bad input is fatal.
   */
  private resolve(target: LLMTarget, messages: LlmMessage[], tools: LlmTool[] | undefined, signal?: AbortSignal) {
    if ("error" in target) throw target.error;
    const llmManifest = this.llmManifestsRegistry.find(target.llm);
    if (!llmManifest) throw new LLMError(LLMErrorCode.LLM_NOT_FOUND, `llm "${target.llm}" not found`);
    const chat = this.llmDriversRegistry.resolve(llmManifest, "chat", target.connection);
    if (!chat) throw new LLMError(LLMErrorCode.BAD_REQUEST, `"${target.llm}" does not support chat`);
    const request: ChatRequest = { model: target.model, messages, tools, signal };
    return { driver: chat.driver, options: chat.options, request };
  }
}
