import type { LlmConnectionOptions, LlmModel, LlmProviderInfo, LlmResponse } from "@snipet/shared";
import OpenAI, { APIConnectionError, APIError, APIUserAbortError } from "openai";

import { LlmError, llmErrorFromStatus } from "../../errors.js";
import type { GenerateRequest, LlmProvider, ProviderStreamEvent } from "../../provider.js";
import { fromCompletion, toOpenAiMessages, toOpenAiTools, toStreamEvents } from "./openai.mapper.js";

const AUTH_SCHEMA = {
  type: "object",
  required: ["apiKey"],
  additionalProperties: false,
  properties: { apiKey: { type: "string", minLength: 1, description: "Sent as Authorization: Bearer <apiKey>" } },
};

const CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    baseUrl: { type: "string", description: "API base URL. Defaults to the provider's own endpoint." },
    organization: { type: "string", description: "Sent as the OpenAI-Organization header" },
    headers: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Extra headers on every request",
    },
  },
};

type Config = { baseUrl?: string; organization?: string; headers?: Record<string, string> };

const OPENAI_INFO: LlmProviderInfo = {
  key: "openai",
  name: "OpenAI",
  description: "GPT models served by the OpenAI API",
  icon: "https://openai.com/favicon.ico",
  tags: ["cloud"],
  auth: [{ type: "static", data: AUTH_SCHEMA }],
  schemas: { config: CONFIG_SCHEMA },
};

// Chat Completions via the official SDK. Any OpenAI-compatible service (Groq,
// Together, OpenRouter, ...) is another instance with its own info + base URL.
export class OpenAiProvider implements LlmProvider {
  constructor(
    readonly info: LlmProviderInfo = OPENAI_INFO,
    private readonly defaultBaseUrl = "https://api.openai.com/v1",
  ) {}

  async models(options: LlmConnectionOptions): Promise<LlmModel[]> {
    try {
      const models: LlmModel[] = [];
      // The endpoint has no capability data, so every model is reported alike.
      for await (const m of this.client(options).models.list()) {
        models.push({
          key: m.id,
          name: m.id,
          description: "",
          capabilities: ["text", "streaming", "tools"],
          contextWindow: 0,
        });
      }
      return models;
    } catch (err) {
      throw toLlmError(err);
    }
  }

  // Listing models checks both reachability and the key.
  async healthCheck(options: LlmConnectionOptions): Promise<void> {
    await this.models(options);
  }

  async generate(req: GenerateRequest): Promise<LlmResponse> {
    try {
      const completion = await this.client(req.connectionOptions).chat.completions.create(
        {
          ...req.extraOptions,
          model: req.model,
          messages: toOpenAiMessages(req.messages),
          tools: toOpenAiTools(req.tools),
          stream: false,
        },
        { signal: req.signal },
      );
      return fromCompletion(completion);
    } catch (err) {
      throw toLlmError(err);
    }
  }

  async *stream(req: GenerateRequest): AsyncGenerator<ProviderStreamEvent> {
    try {
      const chunks = await this.client(req.connectionOptions).chat.completions.create(
        {
          ...req.extraOptions,
          model: req.model,
          messages: toOpenAiMessages(req.messages),
          tools: toOpenAiTools(req.tools),
          stream: true,
        },
        { signal: req.signal },
      );
      yield* toStreamEvents(chunks);
    } catch (err) {
      throw toLlmError(err);
    }
  }

  private client({ auth, config }: LlmConnectionOptions): OpenAI {
    const { baseUrl, organization, headers } = (config ?? {}) as Config;
    return new OpenAI({
      // Compatible services without auth still need a non-empty key for the SDK.
      apiKey: (auth?.apiKey as string | undefined) || "none",
      baseURL: baseUrl?.trim() || this.defaultBaseUrl,
      organization: organization || null,
      defaultHeaders: headers,
      // The runner fails over to the next target instead of retrying.
      maxRetries: 0,
    });
  }
}

function toLlmError(err: unknown): unknown {
  if (err instanceof LlmError || err instanceof APIUserAbortError) return err;
  if (err instanceof APIConnectionError) return new LlmError("unavailable", `openai: ${err.message}`);
  if (err instanceof APIError && typeof err.status === "number") {
    return llmErrorFromStatus(err.status, `openai: ${err.message}`);
  }
  return err;
}
