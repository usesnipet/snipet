import type { ChatResponse } from "ollama";

import { OllamaChatDriver } from "./ollama.chat.js";
import { fromChatResponse, toOllamaMessages, toStreamEvents } from "./ollama.mapper.js";

const chunk = (message: object, done = false, extra: object = {}) =>
  ({ message: { role: "assistant", content: "", ...message }, done, ...extra }) as unknown as ChatResponse;

// eslint-disable-next-line @typescript-eslint/require-await -- fake stream
async function* from(chunks: ChatResponse[]) {
  yield* chunks;
}

describe("ollama mapper", () => {
  it("streams text, whole tool calls and usage on done", async () => {
    const events = [];
    for await (const e of toStreamEvents(
      from([
        chunk({ thinking: "hmm" }),
        chunk({ content: "Hi" }),
        chunk({ tool_calls: [{ id: "c1", function: { name: "weather", arguments: { city: "SP" } } }] }),
        chunk({}, true, { prompt_eval_count: 12, eval_count: 3 }),
      ]),
    )) {
      events.push(e);
    }
    expect(events).toEqual([
      { event: "thinking_delta", data: { text: "hmm" } },
      { event: "text_delta", data: { text: "Hi" } },
      { event: "tool_call", data: { id: "c1", name: "weather", arguments: { city: "SP" } } },
      { event: "usage", data: { inputTokens: 12, outputTokens: 3 } },
    ]);
  });

  it("maps a response with tool calls, making up missing ids", () => {
    const res = fromChatResponse(
      chunk({ tool_calls: [{ function: { name: "weather", arguments: {} } }] }, true, { done_reason: "stop" }),
    );
    expect(res.finishReason).toBe("tool_call");
    expect(res.message.parts[0]).toMatchObject({ type: "tool_call", name: "weather" });
    expect(res.message.parts[0]).toHaveProperty("id", expect.stringMatching(/.+/));
  });

  it("maps tool results by name and unwraps data URI images", () => {
    expect(
      toOllamaMessages([
        {
          role: "user",
          parts: [
            { type: "text", text: "see" },
            { type: "image", source: "data:image/png;base64,AAA", mimeType: "image/png" },
          ],
        },
        {
          role: "assistant",
          parts: [
            { type: "thinking", text: "hmm" },
            { type: "tool_call", id: "c1", name: "weather", arguments: { city: "SP" } },
          ],
        },
        { role: "tool", parts: [{ type: "tool_result", toolCallId: "c1", content: "sunny" }] },
      ]),
    ).toEqual([
      { role: "user", content: "see", images: ["AAA"] },
      {
        role: "assistant",
        content: "",
        thinking: "hmm",
        tool_calls: [{ function: { name: "weather", arguments: { city: "SP" } } }],
      },
      { role: "tool", content: "sunny", tool_name: "weather" },
    ]);
  });
});

describe("ollama chat driver", () => {
  it("reports an unreachable server as unavailable", async () => {
    const driver = new OllamaChatDriver();
    await expect(
      driver.generate({ model: "x", messages: [] }, driver.validateOptions({ baseUrl: "http://localhost:1" })),
    ).rejects.toMatchObject({ kind: "unavailable" });
  });
});
