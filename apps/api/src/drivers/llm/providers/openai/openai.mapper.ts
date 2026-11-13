import { LLMFinishReason, LLMMessagePartType, LLMRole, LLMStreamEventType } from "@snipet/shared/core";

import type { LLMMessage, LLMMessagePart, LLMResponse, LLMTool } from "@snipet/shared/core";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import type { ChatStreamEvent } from "#src/core/llm/driver.js";

// Pure mapping between our message model and the Chat Completions API.

export function toOpenAiMessages(messages: LLMMessage[]): ChatCompletionMessageParam[] {
  return messages.flatMap((m): ChatCompletionMessageParam[] => {
    const text = m.parts.flatMap((p) => (p.type === LLMMessagePartType.TEXT ? [p.text] : [])).join("");
    switch (m.role) {
      case LLMRole.SYSTEM:
        return [{ role: "system", content: text }];
      case LLMRole.USER: {
        if (!m.parts.some((p) => p.type === LLMMessagePartType.IMAGE)) return [{ role: "user", content: text }];
        const content = m.parts.flatMap((p): ChatCompletionContentPart[] => {
          if (p.type === LLMMessagePartType.TEXT) return [{ type: "text", text: p.text }];
          if (p.type === LLMMessagePartType.IMAGE)
            return [{ type: "image_url", image_url: { url: imageUrl(p.source, p.mimeType) } }];
          return [];
        });
        return [{ role: "user", content }];
      }
      case LLMRole.ASSISTANT: {
        const toolCalls = m.parts.flatMap((p) =>
          p.type === LLMMessagePartType.TOOL_CALL
            ? [
                {
                  id: p.id,
                  type: "function" as const,
                  function: { name: p.name, arguments: JSON.stringify(p.arguments ?? {}) },
                },
              ]
            : [],
        );
        return [{ role: "assistant", content: text || null, ...(toolCalls.length > 0 && { tool_calls: toolCalls }) }];
      }
      case LLMRole.TOOL:
        // One API message per result.
        return m.parts.flatMap((p) =>
          p.type === LLMMessagePartType.TOOL_RESULT
            ? [{ role: "tool" as const, tool_call_id: p.toolCallId, content: p.content }]
            : [],
        );
    }
  });
}

export function toOpenAiTools(tools: LLMTool[] | undefined): ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export function fromCompletion(completion: ChatCompletion): LLMResponse {
  const choice = completion.choices[0];
  if (!choice) throw new Error("openai: response had no choices");
  const parts: LLMMessagePart[] = [];
  if (choice.message.content) parts.push({ type: LLMMessagePartType.TEXT, text: choice.message.content });
  for (const call of choice.message.tool_calls ?? []) {
    if (call.type !== "function") continue;
    parts.push({
      type: LLMMessagePartType.TOOL_CALL,
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    });
  }
  return {
    message: { role: LLMRole.ASSISTANT, parts },
    finishReason: finishReason(
      choice.finish_reason,
      parts.some((p) => p.type === LLMMessagePartType.TOOL_CALL),
    ),
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Text deltas pass through; tool call fragments are accumulated per index and
 * emitted whole when the model finishes calling tools (or the stream ends).
 */
export async function* toStreamEvents(chunks: AsyncIterable<ChatCompletionChunk>): AsyncGenerator<ChatStreamEvent> {
  const pending = new Map<number, { id: string; name: string; args: string }>();
  function* flush(): Generator<ChatStreamEvent> {
    for (const call of pending.values()) {
      yield {
        event: LLMStreamEventType.TOOL_CALL,
        data: { call: { id: call.id, name: call.name, arguments: parseArguments(call.args || "{}") } },
      };
    }
    pending.clear();
  }

  for await (const chunk of chunks) {
    // With include_usage the last chunk carries the totals and no choices.
    if (chunk.usage) {
      yield* flush();
      yield {
        event: LLMStreamEventType.USAGE,
        data: { usage: { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens } },
      };
    }
    for (const choice of chunk.choices) {
      if (choice.delta.content) yield { event: LLMStreamEventType.TEXT_DELTA, data: { text: choice.delta.content } };
      for (const delta of choice.delta.tool_calls ?? []) {
        const call = pending.get(delta.index) ?? { id: "", name: "", args: "" };
        call.id ||= delta.id ?? "";
        call.name ||= delta.function?.name ?? "";
        call.args += delta.function?.arguments ?? "";
        pending.set(delta.index, call);
      }
      if (choice.finish_reason === "tool_calls" || choice.finish_reason === "function_call") yield* flush();
    }
  }
  yield* flush();
}

function finishReason(raw: string | null, hasToolCalls: boolean): LLMFinishReason {
  if (raw === "length") return LLMFinishReason.LENGTH;
  if (raw === "tool_calls" || raw === "function_call" || (raw !== "stop" && hasToolCalls))
    return LLMFinishReason.TOOL_CALL;
  return LLMFinishReason.STOP;
}

/** Tool arguments arrive as a JSON string; keep the raw string if it isn't valid JSON. */
function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** http(s) and data: URIs pass through; bare base64 is wrapped in a data URI. */
function imageUrl(source: string, mimeType: string): string {
  const s = source.trim();
  if (/^(https?:|data:)/.test(s)) return s;
  return `data:${mimeType || "image/png"};base64,${s}`;
}
