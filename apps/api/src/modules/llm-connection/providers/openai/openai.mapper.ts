import type { LlmFinishReason, LlmMessage, LlmPart, LlmResponse, LlmTool } from "@snipet/shared";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import type { ProviderStreamEvent } from "../../llm/provider.js";

// Pure mapping between our message model and the Chat Completions API.

export function toOpenAiMessages(messages: LlmMessage[]): ChatCompletionMessageParam[] {
  return messages.flatMap((m): ChatCompletionMessageParam[] => {
    const text = m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
    switch (m.role) {
      case "system":
        return [{ role: "system", content: text }];
      case "user": {
        if (!m.parts.some((p) => p.type === "image")) return [{ role: "user", content: text }];
        const content = m.parts.flatMap((p): ChatCompletionContentPart[] => {
          if (p.type === "text") return [{ type: "text", text: p.text }];
          if (p.type === "image") return [{ type: "image_url", image_url: { url: imageUrl(p.source, p.mimeType) } }];
          return [];
        });
        return [{ role: "user", content }];
      }
      case "assistant": {
        const toolCalls = m.parts.flatMap((p) =>
          p.type === "tool_call"
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
      case "tool":
        // One API message per result.
        return m.parts.flatMap((p) =>
          p.type === "tool_result" ? [{ role: "tool" as const, tool_call_id: p.toolCallId, content: p.content }] : [],
        );
    }
  });
}

export function toOpenAiTools(tools: LlmTool[] | undefined): ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function fromCompletion(completion: ChatCompletion): LlmResponse {
  const choice = completion.choices[0];
  if (!choice) throw new Error("openai: response had no choices");
  const parts: LlmPart[] = [];
  if (choice.message.content) parts.push({ type: "text", text: choice.message.content });
  for (const call of choice.message.tool_calls ?? []) {
    if (call.type !== "function") continue;
    parts.push({
      type: "tool_call",
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    });
  }
  return {
    message: { role: "assistant", parts },
    finishReason: finishReason(
      choice.finish_reason,
      parts.some((p) => p.type === "tool_call"),
    ),
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

// Text deltas pass through; tool call fragments are accumulated per index and
// emitted whole when the model finishes calling tools (or the stream ends).
export async function* toStreamEvents(chunks: AsyncIterable<ChatCompletionChunk>): AsyncGenerator<ProviderStreamEvent> {
  const pending = new Map<number, { id: string; name: string; args: string }>();
  function* flush(): Generator<ProviderStreamEvent> {
    for (const call of pending.values()) {
      yield {
        event: "tool_call",
        data: { id: call.id, name: call.name, arguments: parseArguments(call.args || "{}") },
      };
    }
    pending.clear();
  }

  for await (const chunk of chunks) {
    for (const choice of chunk.choices) {
      if (choice.delta.content) yield { event: "text_delta", data: { text: choice.delta.content } };
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

function finishReason(raw: string | null, hasToolCalls: boolean): LlmFinishReason {
  if (raw === "length") return "length";
  if (raw === "tool_calls" || raw === "function_call" || (raw !== "stop" && hasToolCalls)) return "tool_call";
  return "stop";
}

// Tool arguments arrive as a JSON string; keep the raw string if it isn't valid JSON.
function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// http(s) and data: URIs pass through; bare base64 is wrapped in a data URI.
function imageUrl(source: string, mimeType: string): string {
  const s = source.trim();
  if (/^(https?:|data:)/.test(s)) return s;
  return `data:${mimeType || "image/png"};base64,${s}`;
}
