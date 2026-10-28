import { randomUUID } from "node:crypto";

import { LlmError } from "../../errors.js";

import type { LlmFinishReason, LlmMessage, LlmPart, LlmResponse, LlmTool } from "@snipet/shared";
import type { ChatResponse, Message, Tool, ToolCall } from "ollama";
import type { ChatStreamEvent } from "../../driver.js";

// Pure mapping between our message model and Ollama's /api/chat.

export function toOllamaMessages(messages: LlmMessage[]): Message[] {
  // Ollama matches tool results by tool name, not call id.
  const toolNames = new Map<string, string>();
  return messages.flatMap((m): Message[] => {
    const content = m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
    switch (m.role) {
      case "system":
        return [{ role: "system", content }];
      case "user": {
        const images = m.parts.flatMap((p) => (p.type === "image" ? [base64(p.source)] : []));
        return [{ role: "user", content, ...(images.length > 0 && { images }) }];
      }
      case "assistant": {
        const thinking = m.parts.flatMap((p) => (p.type === "thinking" ? [p.text] : [])).join("");
        const toolCalls = m.parts.flatMap((p): ToolCall[] => {
          if (p.type !== "tool_call") return [];
          toolNames.set(p.id, p.name);
          return [{ function: { name: p.name, arguments: p.arguments ?? {} } }];
        });
        return [
          {
            role: "assistant",
            content,
            ...(thinking && { thinking }),
            ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
          },
        ];
      }
      case "tool":
        return m.parts.flatMap((p) =>
          p.type === "tool_result"
            ? [{ role: "tool", content: p.content, tool_name: toolNames.get(p.toolCallId) ?? "" }]
            : [],
        );
    }
  });
}

export function toOllamaTools(tools: LlmTool[] | undefined): Tool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function fromChatResponse(res: ChatResponse): LlmResponse {
  const parts: LlmPart[] = [];
  if (res.message.thinking) parts.push({ type: "thinking", text: res.message.thinking });
  if (res.message.content) parts.push({ type: "text", text: res.message.content });
  parts.push(...(res.message.tool_calls ?? []).map(toToolCallPart));
  return {
    message: { role: "assistant", parts },
    finishReason: finishReason(
      res.done_reason,
      parts.some((p) => p.type === "tool_call"),
    ),
    usage: usage(res),
  };
}

/** Ollama sends each tool call whole, and the token counts on the final chunk. */
export async function* toStreamEvents(chunks: AsyncIterable<ChatResponse>): AsyncGenerator<ChatStreamEvent> {
  for await (const chunk of chunks) {
    if (chunk.message.thinking) yield { event: "thinking_delta", data: { text: chunk.message.thinking } };
    if (chunk.message.content) yield { event: "text_delta", data: { text: chunk.message.content } };
    for (const call of chunk.message.tool_calls ?? []) {
      const { id, name, arguments: args } = toToolCallPart(call);
      yield { event: "tool_call", data: { id, name, arguments: args } };
    }
    if (chunk.done) yield { event: "usage", data: usage(chunk) };
  }
}

/** Calls carry no id in the SDK types; newer servers send one, else we make it up. */
function toToolCallPart(call: ToolCall): Extract<LlmPart, { type: "tool_call" }> {
  const id = (call as ToolCall & { id?: string }).id;
  return { type: "tool_call", id: id || randomUUID(), name: call.function.name, arguments: call.function.arguments };
}

function usage(res: ChatResponse) {
  return { inputTokens: res.prompt_eval_count ?? 0, outputTokens: res.eval_count ?? 0 };
}

function finishReason(raw: string | undefined, hasToolCalls: boolean): LlmFinishReason {
  if (raw === "length") return "length";
  return hasToolCalls ? "tool_call" : "stop";
}

/** Ollama takes bare base64 only: data URIs are unwrapped, URLs are refused. */
function base64(source: string): string {
  const s = source.trim();
  if (/^https?:/.test(s)) throw new LlmError("bad_request", "ollama: image URLs are not supported, send base64");
  return s.replace(/^data:[^,]*,/, "");
}
