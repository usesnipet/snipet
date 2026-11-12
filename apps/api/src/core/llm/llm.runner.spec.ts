import { LLMFinishReason, LLMMessagePartType, LLMRole, LLMStreamEventType } from "@snipet/shared/core";

import { FailoverError, LLMError, LLMErrorCode, llmProviderError } from "./errors.js";
import { LLMDriverRegistry } from "./llm.registry.js";
import { LLMRunner } from "./llm.runner.js";

import type { ChatDriver, ChatStreamEvent } from "./driver.js";
import type { LLMManifestRegistry } from "./llm.registry.js";
import type { LLMManifest, LLMResponse, LLMStreamEvent, LLMTarget } from "@snipet/shared/core";

const reply = (text: string): LLMResponse => ({
  message: { role: LLMRole.ASSISTANT, parts: [{ type: LLMMessagePartType.TEXT, text }] },
  finishReason: LLMFinishReason.STOP,
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
      yield { event: LLMStreamEventType.TEXT_DELTA, data: { text: "he" } };
      yield { event: LLMStreamEventType.TEXT_DELTA, data: { text: "llo" } };
      yield {
        event: LLMStreamEventType.TOOL_CALL,
        data: { call: { id: "1", name: "t", arguments: { a: 1 } } },
      };
    },
  };
}

/** A chat driver that fails with a plain Error, which is not an LLMError. */
function crash(key: string): ChatDriver {
  return {
    key,
    validateOptions: (o) => o,
    generate: () => Promise.reject(new Error("crash")),
    // eslint-disable-next-line require-yield, @typescript-eslint/require-await -- fails before yielding
    async *stream(): AsyncGenerator<ChatStreamEvent> {
      throw new Error("crash");
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
        } as LLMManifest),
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
/** A run over `refs` ("llm/model"), each target with an empty connection config. */
const run = (...refs: string[]) => ({
  targets: refs.map((ref): LLMTarget => {
    const [llm, model] = ref.split("/");
    return { llm, model, connection: {} };
  }),
  messages: [{ role: LLMRole.USER, parts: [{ type: LLMMessagePartType.TEXT as const, text: "hi" }] }],
});

async function collect(it: AsyncIterable<LLMStreamEvent>) {
  const events: LLMStreamEvent[] = [];
  for await (const e of it) events.push(e);
  return events;
}

describe("LLMRunner", () => {
  it("fails over to the next target", async () => {
    await expect(runner.generate(run("limited/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("down/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("gone/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("nomodel/m", "ok/m"))).resolves.toEqual(reply("ok"));
  });

  it("fails over on any LLMError, including targets that arrive unusable", async () => {
    const ok = run("ok/m").targets[0];
    const gone: LLMTarget = { model: "m", error: "connection gone" };
    await expect(runner.generate({ ...run(), targets: [gone, ok] })).resolves.toEqual(reply("ok"));
    expect((await collect(runner.stream({ ...run(), targets: [gone, ok] })))[0]).toEqual({
      event: "llm_skipped",
      data: { model: "m", error: "connection gone" },
    });
    await expect(runner.generate(run("broken/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("nochat/m", "ok/m"))).resolves.toEqual(reply("ok"));
    await expect(runner.generate(run("limited/m"))).rejects.toBeInstanceOf(FailoverError);
    await expect(runner.generate(run("nochat/m"))).rejects.toBeInstanceOf(FailoverError);
  });

  it("rethrows errors that aren't an LLMError without failing over", async () => {
    const boom = new LLMRunner(llms, new LLMDriverRegistry({ chat: [crash("boom")], models: [], healthCheck: [] }));
    await expect(boom.generate(run("boom/m", "ok/m"))).rejects.toThrow("crash");
  });

  it("closes the driver stream when the consumer stops early", async () => {
    let closed = false;
    const driver: ChatDriver = {
      key: "slow",
      validateOptions: (o) => o,
      generate: () => Promise.resolve(reply("slow")),
      // eslint-disable-next-line @typescript-eslint/require-await -- fake stream
      async *stream(): AsyncGenerator<ChatStreamEvent> {
        try {
          yield { event: LLMStreamEventType.TEXT_DELTA, data: { text: "a" } };
          yield { event: LLMStreamEventType.TEXT_DELTA, data: { text: "b" } };
        } finally {
          closed = true;
        }
      },
    };
    const slow = new LLMRunner(llms, new LLMDriverRegistry({ chat: [driver], models: [], healthCheck: [] }));
    for await (const event of slow.stream(run("slow/m"))) if (event.event === LLMStreamEventType.TEXT_DELTA) break;
    expect(closed).toBe(true);
  });

  it("skips an unavailable target in a stream without leaking its message", async () => {
    const events = await collect(runner.stream(run("down/m", "ok/m")));
    expect(events.slice(0, 2)).toEqual([
      {
        event: "llm_skipped",
        data: { model: "m", error: "llm provider unavailable" },
      },
      { event: "llm_started", data: { model: "m" } },
    ]);
    expect(JSON.stringify(events)).not.toContain("10.0.0.1");
  });

  it("streams skip, start, events and the assembled message", async () => {
    expect(await collect(runner.stream(run("limited/m", "ok/m")))).toEqual([
      {
        event: "llm_skipped",
        data: { model: "m", error: "llm provider rate limited" },
      },
      { event: "llm_started", data: { model: "m" } },
      { event: "text_delta", data: { text: "he" } },
      { event: "text_delta", data: { text: "llo" } },
      { event: "tool_call", data: { call: { id: "1", name: "t", arguments: { a: 1 } } } },
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
