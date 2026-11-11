import { FailoverError, LLMError, LLMErrorCode, llmProviderError } from "./errors.js";
import { LLMDriverRegistry } from "./llm.registry.js";
import { LLMRunner } from "./llm.runner.js";

import type { LlmManifest, LlmResponse, LlmStreamEvent } from "@snipet/shared";
import type { ChatDriver, ChatStreamEvent } from "./driver.js";
import type { LLMManifestRegistry } from "./llm.registry.js";

const reply = (text: string): LlmResponse => ({
  message: { role: "assistant", parts: [{ type: "text", text }] },
  finishReason: "stop",
  usage: { inputTokens: 1, outputTokens: 1 },
});

// A chat driver whose generate/stream fail with `error` (if set) or answer `key`.
function fake(key: string, error?: LLMError): ChatDriver {
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

// Each llm "x" uses chat driver "x"; "nochat" has none; "gone" has no manifest.
const llms = {
  find: (key: string) =>
    key === "gone"
      ? undefined
      : ({
          key,
          capabilities: {
            models: { driver: "static", options: {} },
            ...(key !== "nochat" && { chat: { driver: key, options: {} } }),
          },
        } as LlmManifest),
} as unknown as LLMManifestRegistry;

const runner = new LLMRunner(
  llms,
  new LLMDriverRegistry({
    chat: [
      fake("limited", llmProviderError(LLMErrorCode.RATE_LIMIT, new Error("slow down"))),
      fake("down", llmProviderError(LLMErrorCode.UNAVAILABLE, new Error("connect ECONNREFUSED 10.0.0.1"))),
      fake("nomodel", llmProviderError(LLMErrorCode.MODEL_NOT_FOUND, new Error("model gpt-x does not exist"))),
      fake("broken", new LLMError(LLMErrorCode.BAD_REQUEST, "nope")),
      fake("ok"),
    ],
    models: [],
    healthCheck: [],
  }),
);
/** A run over `refs` ("llm/model"), each target on connection "c-<llm>" with an empty config. */
const run = (...refs: string[]) => ({
  targets: refs.map((ref) => {
    const [llm, model] = ref.split("/");
    return { connectionId: `c-${llm}`, llm, model, connection: {} };
  }),
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
    await expect(runner.generate(run("down/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("gone/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("nomodel/m", "ok/m"))).resolves.toEqual(reply("ok"));
  });

  it("skips a target that arrives already unusable, and stops on one that isn't a failover", async () => {
    const ok = run("ok/m").targets[0];
    const gone = {
      connectionId: "c-x",
      model: "m",
      error: new LLMError(LLMErrorCode.CONNECTION_NOT_FOUND, "connection gone"),
    };
    const bad = { connectionId: "c-x", model: "m", error: new LLMError(LLMErrorCode.BAD_REQUEST, "bad target") };
    await expect(runner.generate({ ...run(), targets: [gone, ok] })).resolves.toEqual(reply("ok"));
    await expect(runner.generate({ ...run(), targets: [bad, ok] })).rejects.toThrow("bad target");
    expect((await collect(runner.stream({ ...run(), targets: [gone, ok] })))[0]).toEqual({
      event: "llm_skipped",
      data: { connectionId: "c-x", model: "m", error: "connection gone" },
    });
    await expect(runner.generate(run("broken/m", "ok/m"))).rejects.toThrow("nope");
    await expect(runner.generate(run("limited/m"))).rejects.toBeInstanceOf(FailoverError);
    await expect(runner.generate(run("nochat/m"))).rejects.toThrow('"nochat" does not support chat');
  });

  it("skips an unavailable target in a stream without leaking its message", async () => {
    const events = await collect(runner.stream(run("down/m", "ok/m")));
    expect(events.slice(0, 2)).toEqual([
      { event: "llm_skipped", data: { connectionId: "c-down", model: "m", error: "llm provider unavailable" } },
      { event: "llm_started", data: { model: "m" } },
    ]);
    expect(JSON.stringify(events)).not.toContain("10.0.0.1");
  });

  it("streams skip, start, events and the assembled message", async () => {
    expect(await collect(runner.stream(run("limited/m", "ok/m")))).toEqual([
      { event: "llm_skipped", data: { connectionId: "c-limited", model: "m", error: "llm provider rate limited" } },
      { event: "llm_started", data: { model: "m" } },
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
