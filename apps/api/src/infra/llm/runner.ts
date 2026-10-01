import type { LlmConnectionOptions, LlmMessage, LlmPart, LlmResponse, LlmStreamEvent, LlmTool } from "@snipet/shared";

import { attemptReason, FailoverError, isFailover, LlmError } from "./errors.js";
import type { GenerateRequest, LlmProvider } from "./provider.js";
import { LlmRegistry, validateOptions } from "./registry.js";

export interface LlmTarget {
  model: string; // "provider/model"
  connectionOptions: LlmConnectionOptions;
  extraOptions?: Record<string, unknown>;
}

export interface RunInput {
  targets: LlmTarget[];
  messages: LlmMessage[];
  tools?: LlmTool[];
  signal?: AbortSignal;
}

// Splits "provider/model" on the first "/", so a model id may contain "/".
export function splitModelRef(ref: string): [provider: string, model: string] {
  const i = ref.indexOf("/");
  if (i <= 0 || i === ref.length - 1) throw new LlmError("bad_request", `bad model ref "${ref}"`);
  return [ref.slice(0, i), ref.slice(i + 1)];
}

// Runs a conversation against an ordered list of targets, failing over to
// the next one on rate limit / auth / unavailable errors.
export class LlmRunner {
  constructor(private readonly registry: LlmRegistry) {}

  async generate({ targets, messages, tools, signal }: RunInput): Promise<LlmResponse> {
    if (targets.length === 0) throw new LlmError("bad_request", "no targets");
    const attempts: FailoverError["attempts"] = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      try {
        const { provider, request } = await this.resolve(target, messages, tools, signal);
        if (!provider.generate) throw new LlmError("bad_request", `"${target.model}" does not support generate`);
        return await provider.generate(request);
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
        const { provider, request } = await this.resolve(target, messages, tools, signal);
        if (!provider.stream) throw new LlmError("bad_request", `"${target.model}" does not support stream`);
        iterator = provider.stream(request)[Symbol.asyncIterator]();
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

  // Validates one target: model ref, connection (auth/config/health), model
  // exists, extra options. Bad input is fatal, never a failover.
  private async resolve(
    target: LlmTarget,
    messages: LlmMessage[],
    tools: LlmTool[] | undefined,
    signal: AbortSignal | undefined,
  ): Promise<{ provider: LlmProvider; request: GenerateRequest }> {
    const [providerKey, model] = splitModelRef(target.model);
    const provider = await this.registry.connect(providerKey, target.connectionOptions);
    if (!(await this.registry.hasModel(providerKey, model, target.connectionOptions))) {
      throw new LlmError("model_not_found", `model "${target.model}" not found`);
    }
    const extraOptions = validateOptions<Record<string, unknown>>(
      provider.info.schemas.generateExtraOptions,
      target.extraOptions,
      "extraOptions",
    );
    return {
      provider,
      request: { model, messages, tools, extraOptions, connectionOptions: target.connectionOptions, signal },
    };
  }
}
