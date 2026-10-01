import type {
  LlmCapability,
  LlmConnectionOptions,
  LlmMessage,
  LlmModel,
  LlmPart,
  LlmProviderInfo,
  LlmResponse,
  LlmTool,
} from "@snipet/shared";
import { Ollama, type ChatResponse, type Message, type Tool } from "ollama";

import { LlmError, llmErrorFromStatus } from "../../errors.js";
import type { GenerateRequest, LlmProvider, ProviderStreamEvent } from "../../provider.js";
import { validateOptions } from "../../registry.js";

const CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    baseUrl: { type: "string", default: "http://localhost:11434", description: "Ollama server URL" },
    headers: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Extra headers, e.g. for an auth proxy",
    },
  },
};

type Config = { baseUrl: string; headers?: Record<string, string> };

// Ollama capability names -> ours (the Go driver's mapping).
const CAPABILITIES: Record<string, LlmCapability[]> = {
  completion: ["text", "streaming"],
  vision: ["vision"],
  tools: ["tools"],
  embedding: ["embedding"],
};

// Local models via the official `ollama` lib (native API, no credentials).
export class OllamaProvider implements LlmProvider {
  readonly info: LlmProviderInfo = {
    key: "ollama",
    name: "Ollama",
    description: "Local models served by an Ollama server",
    icon: "https://ollama.com/public/ollama.png",
    tags: ["local", "self-hosted", "open-source"],
    auth: [{ type: "no-auth" }],
    schemas: { config: CONFIG_SCHEMA },
  };

  async models(options: LlmConnectionOptions): Promise<LlmModel[]> {
    try {
      const { models } = await this.client(options).list();
      return models.map((m) => {
        // Recent servers include capabilities in /api/tags; the lib's type doesn't know yet.
        const caps = (m as { capabilities?: string[] }).capabilities;
        return {
          key: m.model,
          name: m.name,
          description: "",
          capabilities: caps
            ? [...new Set(caps.flatMap((c) => CAPABILITIES[c] ?? []))]
            : ["text", "streaming", "tools"],
          contextWindow: 0,
        };
      });
    } catch (err) {
      throw toLlmError(err);
    }
  }

  async healthCheck(options: LlmConnectionOptions): Promise<void> {
    try {
      await this.client(options).version();
    } catch (err) {
      throw toLlmError(err);
    }
  }

  async generate(req: GenerateRequest): Promise<LlmResponse> {
    try {
      const res = await this.client(req.connectionOptions, req.signal).chat({
        model: req.model,
        messages: toOllamaMessages(req.messages),
        tools: toOllamaTools(req.tools),
        options: req.extraOptions,
        stream: false,
      });
      const parts = partsOf(res.message);
      return {
        message: { role: "assistant", parts },
        finishReason: parts.some((p) => p.type === "tool_call")
          ? "tool_call"
          : res.done_reason === "length"
            ? "length"
            : "stop",
        usage: { inputTokens: res.prompt_eval_count ?? 0, outputTokens: res.eval_count ?? 0 },
      };
    } catch (err) {
      throw toLlmError(err);
    }
  }

  async *stream(req: GenerateRequest): AsyncGenerator<ProviderStreamEvent> {
    try {
      const chunks = await this.client(req.connectionOptions, req.signal).chat({
        model: req.model,
        messages: toOllamaMessages(req.messages),
        tools: toOllamaTools(req.tools),
        options: req.extraOptions,
        stream: true,
      });
      for await (const chunk of chunks) {
        for (const part of partsOf(chunk.message)) {
          if (part.type === "text") yield { event: "text_delta", data: { text: part.text } };
          if (part.type === "tool_call")
            yield { event: "tool_call", data: { id: part.id, name: part.name, arguments: part.arguments } };
        }
      }
    } catch (err) {
      throw toLlmError(err);
    }
  }

  private client(options: LlmConnectionOptions, signal?: AbortSignal): Ollama {
    const { baseUrl, headers } = validateOptions<Config>(this.info.schemas.config, options.config, "config");
    return new Ollama({
      host: baseUrl,
      headers,
      // Tie every request (the lib's own stream aborts included) to the caller's signal.
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: signal ? AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) : init?.signal,
        }),
    });
  }
}

function toOllamaMessages(messages: LlmMessage[]): Message[] {
  return messages.flatMap((m): Message[] => {
    if (m.role === "tool") {
      return m.parts.flatMap((p) => (p.type === "tool_result" ? [{ role: "tool", content: p.content }] : []));
    }
    const images = m.parts.flatMap((p) => (p.type === "image" ? [p.source.replace(/^data:[^,]*,/, "")] : []));
    const toolCalls = m.parts.flatMap((p) =>
      p.type === "tool_call"
        ? [{ function: { name: p.name, arguments: (p.arguments ?? {}) as Record<string, unknown> } }]
        : [],
    );
    return [
      {
        role: m.role,
        content: m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join(""),
        ...(images.length > 0 && { images }),
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      },
    ];
  });
}

function toOllamaTools(tools: LlmTool[] | undefined): Tool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

// Ollama's tool calls carry no id; number them so results can reference one.
function partsOf(message: ChatResponse["message"]): LlmPart[] {
  const parts: LlmPart[] = [];
  if (message.content) parts.push({ type: "text", text: message.content });
  message.tool_calls?.forEach((call, i) => {
    const id = (call as { id?: string }).id ?? `call_${i}`;
    parts.push({ type: "tool_call", id, name: call.function.name, arguments: call.function.arguments });
  });
  return parts;
}

function toLlmError(err: unknown): unknown {
  if (err instanceof LlmError || (err instanceof Error && err.name === "AbortError")) return err;
  // The lib throws ResponseError (not exported) with the HTTP status.
  const status = (err as { status_code?: number }).status_code;
  if (status) return llmErrorFromStatus(status, `ollama: ${(err as Error).message}`);
  // fetch failed: server down or unreachable.
  if (err instanceof TypeError) return new LlmError("unavailable", `ollama: ${err.message}`);
  return err;
}
