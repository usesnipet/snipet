import { Driver } from "#src/manifest/driver.js";
import { LlmCapability } from "@snipet/shared";
import z from "zod";

import { LlmError, llmErrorFromStatus } from "../../errors.js";

import type { LlmModel } from "@snipet/shared";
import type { ModelDriver } from "../../driver.js";

const optionsSchema = z.strictObject({
  baseUrl: z.url(), // Ollama root, e.g. http://localhost:11434
  headers: z.record(z.string(), z.string()).default({}),
});
type OllamaOptions = z.infer<typeof optionsSchema>;

export interface OllamaShow {
  capabilities?: string[];
  model_info?: Record<string, unknown>;
}

const CAPABILITIES: Record<string, LlmCapability> = {
  completion: LlmCapability.TEXT,
  tools: LlmCapability.TOOLS,
  vision: LlmCapability.VISION,
  embedding: LlmCapability.EMBEDDING,
};

export function toLlmModel(name: string, show: OllamaShow): LlmModel {
  const contextLength = Object.entries(show.model_info ?? {}).find(([k]) => k.endsWith(".context_length"))?.[1];
  return {
    key: name,
    name,
    description: "",
    capabilities: (show.capabilities ?? []).flatMap((c) => CAPABILITIES[c] ?? []),
    contextWindow: typeof contextLength === "number" ? contextLength : 0,
  };
}

/**
 * Lists models through Ollama's native api, which unlike /v1/models reports
 * capabilities and context length. Chat goes through the openai driver.
 */
export class OllamaModelDriver extends Driver(optionsSchema) implements ModelDriver<OllamaOptions> {
  readonly key = "ollama";

  async listModels(options: OllamaOptions): Promise<LlmModel[]> {
    const { models } = await call<{ models: { name: string }[] }>(options, "/api/tags");
    return Promise.all(
      models.map(async (m) => toLlmModel(m.name, await call<OllamaShow>(options, "/api/show", { model: m.name }))),
    );
  }
}

async function call<T>({ baseUrl, headers }: OllamaOptions, path: string, body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(new URL(path, baseUrl), {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...headers },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new LlmError("unavailable", `ollama: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw llmErrorFromStatus(res.status, `ollama: HTTP ${res.status} on ${path}`);
  return (await res.json()) as T;
}
