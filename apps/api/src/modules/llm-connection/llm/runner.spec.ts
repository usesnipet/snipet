import type { LlmResponse, LlmStreamEvent } from "@snipet/shared";

import { FailoverError, LlmError } from "./errors.js";
import type { LlmProvider, ProviderStreamEvent } from "./provider.js";
import { LlmRegistry } from "./registry.js";
import { LlmRunner } from "./runner.js";

const reply = (text: string): LlmResponse => ({
  message: { role: "assistant", parts: [{ type: "text", text }] },
  finishReason: "stop",
  usage: { inputTokens: 1, outputTokens: 1 },
});

// A provider whose generate/stream fail with `error` (if set) or answer `text`.
function fake(key: string, error?: LlmError): LlmProvider {
  return {
    info: { key, name: key, description: "", auth: [], schemas: {} },
    models: () => Promise.resolve([{ key: "m", name: "m", description: "", capabilities: ["text"], contextWindow: 0 }]),
    generate: () => (error ? Promise.reject(error) : Promise.resolve(reply(key))),
    // eslint-disable-next-line @typescript-eslint/require-await -- fake stream
    async *stream(): AsyncGenerator<ProviderStreamEvent> {
      if (error) throw error;
      yield { event: "text_delta", data: { text: "he" } };
      yield { event: "text_delta", data: { text: "llo" } };
      yield { event: "tool_call", data: { id: "1", name: "t", arguments: { a: 1 } } };
    },
  };
}

const runner = new LlmRunner(
  new LlmRegistry([
    fake("limited", new LlmError("rate_limit", "slow down")),
    fake("broken", new LlmError("bad_request", "nope")),
    fake("ok"),
  ]),
);
const run = (...models: string[]) => ({
  targets: models.map((model) => ({ model, connectionOptions: {} })),
  messages: [{ role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] }],
});

async function collect(it: AsyncIterable<LlmStreamEvent>) {
  const events: LlmStreamEvent[] = [];
  for await (const e of it) events.push(e);
  return events;
}

describe("LlmRunner", () => {
  it("fails over on failover errors only", async () => {
    await expect(runner.generate(run("limited/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("broken/m", "ok/m"))).rejects.toThrow("nope");
    await expect(runner.generate(run("limited/m"))).rejects.toBeInstanceOf(FailoverError);
    await expect(runner.generate(run("ok/missing"))).rejects.toThrow('model "ok/missing" not found');
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
