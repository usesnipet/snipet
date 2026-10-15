import { FailoverError, LlmError } from "./errors.js";
import { LLMDriverRegistry } from "./llm.registry.js";
import { LLMRunner } from "./llm.runner.js";

import type { LlmManifest, LlmResponse, LlmStreamEvent } from "@snipet/shared";
import type { ChatDriver, ChatStreamEvent } from "./driver.js";
import type { LLMRegistry } from "./llm.registry.js";

const reply = (text: string): LlmResponse => ({
  message: { role: "assistant", parts: [{ type: "text", text }] },
  finishReason: "stop",
  usage: { inputTokens: 1, outputTokens: 1 },
});

// A chat driver whose generate/stream fail with `error` (if set) or answer `key`.
function fake(key: string, error?: LlmError): ChatDriver {
  return {
    key,
    validateOptions: (o) => o,
    generate: () => (error ? Promise.reject(error) : Promise.resolve(reply(key))),
    // eslint-disable-next-line @typescript-eslint/require-await -- fake stream
    async *stream(): AsyncGenerator<ChatStreamEvent> {
      if (error) throw error;
      yield { event: "text_delta", data: { text: "he" } };
      yield { event: "text_delta", data: { text: "llo" } };
      yield { event: "tool_call", data: { id: "1", name: "t", arguments: { a: 1 } } };
    },
  };
}

// Each llm "x" uses chat driver "x"; "nochat" has none.
const llms = {
  get: (key: string) =>
    ({
      key,
      models: { driver: "static", options: {} },
      ...(key !== "nochat" && { chat: { driver: key, options: {} } }),
    }) as LlmManifest,
} as unknown as LLMRegistry;

const runner = new LLMRunner(
  llms,
  new LLMDriverRegistry({
    chat: [
      fake("limited", new LlmError("rate_limit", "slow down")),
      fake("broken", new LlmError("bad_request", "nope")),
      fake("ok"),
    ],
    models: [],
    healthCheck: [],
  }),
);
const run = (...models: string[]) => ({
  targets: models.map((model) => ({ model, connection: {} })),
  messages: [{ role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] }],
});

async function collect(it: AsyncIterable<LlmStreamEvent>) {
  const events: LlmStreamEvent[] = [];
  for await (const e of it) events.push(e);
  return events;
}

describe("LLMRunner", () => {
  it("fails over on failover errors only", async () => {
    await expect(runner.generate(run("limited/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("broken/m", "ok/m"))).rejects.toThrow("nope");
    await expect(runner.generate(run("limited/m"))).rejects.toBeInstanceOf(FailoverError);
    await expect(runner.generate(run("nochat/m"))).rejects.toThrow('"nochat" does not support chat');
  });

  it("streams skip, start, events and the assembled message", async () => {
    expect(await collect(runner.stream(run("limited/m", "ok/m")))).toEqual([
      { event: "llm_skipped", data: { llm: "limited/m", error: "rate limited" } },
      { event: "llm_started", data: { llm: "ok/m" } },
      { event: "text_delta", data: { text: "he" } },
      { event: "text_delta", data: { text: "llo" } },
      { event: "tool_call", data: { id: "1", name: "t", arguments: { a: 1 } } },
      {
        event: "message",
        data: {
          message: {
            role: "assistant",
            parts: [
              { type: "text", text: "hello" },
              { type: "tool_call", id: "1", name: "t", arguments: { a: 1 } },
            ],
          },
        },
      },
    ]);
    await expect(collect(runner.stream(run("limited/m")))).rejects.toBeInstanceOf(FailoverError);
  });
});
