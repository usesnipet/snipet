import { LLMError, LLMErrorCode } from "#src/core/llm/errors.js";
import { randomUUID } from "node:crypto";

import { LLMFinishReason, LLMMessagePartType, LLMRole, LLMStreamEventType } from "@snipet/shared/core";

import type { LLMMessage, LLMMessagePart, LLMResponse, LLMTool } from "@snipet/shared/core";
import type { ChatResponse, Message, Tool, ToolCall } from "ollama";
import type { ChatStreamEvent } from "#src/core/llm/driver.js";

// Pure mapping between our message model and Ollama's /api/chat.

export function toOllamaMessages(messages: LLMMessage[]): Message[] {
  // Ollama matches tool results by tool name, not call id.
  const toolNames = new Map<string, string>();
  return messages.flatMap((m): Message[] => {
    const content = m.parts.flatMap((p) => (p.type === LLMMessagePartType.TEXT ? [p.text] : [])).join("");
    switch (m.role) {
      case LLMRole.SYSTEM:
        return [{ role: "system", content }];
      case LLMRole.USER: {
        const images = m.parts.flatMap((p) => (p.type === LLMMessagePartType.IMAGE ? [base64(p.source)] : []));
        return [{ role: "user", content, ...(images.length > 0 && { images }) }];
      }
      case LLMRole.ASSISTANT: {
        const thinking = m.parts.flatMap((p) => (p.type === LLMMessagePartType.THINKING ? [p.text] : [])).join("");
        const toolCalls = m.parts.flatMap((p): ToolCall[] => {
          if (p.type !== LLMMessagePartType.TOOL_CALL) return [];
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
      case LLMRole.TOOL:
        return m.parts.flatMap((p) =>
          p.type === LLMMessagePartType.TOOL_RESULT
            ? [{ role: "tool", content: p.content, tool_name: toolNames.get(p.toolCallId) ?? "" }]
            : [],
        );
    }
  });
}

export function toOllamaTools(tools: LLMTool[] | undefined): Tool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export function fromChatResponse(res: ChatResponse): LLMResponse {
  const parts: LLMMessagePart[] = [];
  if (res.message.thinking) parts.push({ type: LLMMessagePartType.THINKING, text: res.message.thinking });
  if (res.message.content) parts.push({ type: LLMMessagePartType.TEXT, text: res.message.content });
  parts.push(...(res.message.tool_calls ?? []).map(toToolCallPart));
  return {
    message: { role: LLMRole.ASSISTANT, parts },
    finishReason: finishReason(
      res.done_reason,
      parts.some((p) => p.type === LLMMessagePartType.TOOL_CALL),
    ),
    usage: usage(res),
  };
}

/** Ollama sends each tool call whole, and the token counts on the final chunk. */
export async function* toStreamEvents(chunks: AsyncIterable<ChatResponse>): AsyncGenerator<ChatStreamEvent> {
  for await (const chunk of chunks) {
    if (chunk.message.thinking)
      yield { event: LLMStreamEventType.THINKING_DELTA, data: { text: chunk.message.thinking } };
    if (chunk.message.content) yield { event: LLMStreamEventType.TEXT_DELTA, data: { text: chunk.message.content } };
    for (const call of chunk.message.tool_calls ?? []) {
      const { id, name, arguments: args } = toToolCallPart(call);
      yield { event: LLMStreamEventType.TOOL_CALL, data: { call: { id, name, arguments: args } } };
    }
    if (chunk.done) yield { event: LLMStreamEventType.USAGE, data: { usage: usage(chunk) } };
  }
}

/** Calls carry no id in the SDK types; newer servers send one, else we make it up. */
function toToolCallPart(call: ToolCall): Extract<LLMMessagePart, { type: LLMMessagePartType.TOOL_CALL }> {
  const id = (call as ToolCall & { id?: string }).id;
  return {
    type: LLMMessagePartType.TOOL_CALL,
    id: id || randomUUID(),
    name: call.function.name,
    arguments: call.function.arguments,
  };
}

function usage(res: ChatResponse) {
  return { inputTokens: res.prompt_eval_count ?? 0, outputTokens: res.eval_count ?? 0 };
}

function finishReason(raw: string | undefined, hasToolCalls: boolean): LLMFinishReason {
  if (raw === "length") return LLMFinishReason.LENGTH;
  return hasToolCalls ? LLMFinishReason.TOOL_CALL : LLMFinishReason.STOP;
}

/** Ollama takes bare base64 only: data URIs are unwrapped, URLs are refused. */
function base64(source: string): string {
  const s = source.trim();
  if (/^https?:/.test(s))
    throw new LLMError(LLMErrorCode.BAD_REQUEST, "ollama: image URLs are not supported, send base64");
  return s.replace(/^data:[^,]*,/, "");
}
