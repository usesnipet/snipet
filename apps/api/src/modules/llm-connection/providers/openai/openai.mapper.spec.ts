import type { ChatCompletionChunk } from "openai/resources/chat/completions";

import { toOpenAiMessages, toStreamEvents } from "./openai.mapper.js";

const chunk = (delta: object, finish_reason: string | null = null) =>
  ({ choices: [{ index: 0, delta, finish_reason }] }) as unknown as ChatCompletionChunk;

// eslint-disable-next-line @typescript-eslint/require-await -- fake stream
async function* from(chunks: ChatCompletionChunk[]) {
  yield* chunks;
}

describe("openai mapper", () => {
  it("passes text deltas and assembles tool calls from fragments", async () => {
    const events = [];
    for await (const e of toStreamEvents(
      from([
        chunk({ content: "Hi" }),
        chunk({ tool_calls: [{ index: 0, id: "c1", function: { name: "weather", arguments: '{"ci' } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: 'ty":"SP"}' } }] }),
        chunk({}, "tool_calls"),
      ]),
    )) {
      events.push(e);
    }
    expect(events).toEqual([
      { event: "text_delta", data: { text: "Hi" } },
      { event: "tool_call", data: { id: "c1", name: "weather", arguments: { city: "SP" } } },
    ]);
  });

  it("maps tool calls and results to API messages", () => {
    expect(
      toOpenAiMessages([
        { role: "assistant", parts: [{ type: "tool_call", id: "c1", name: "weather", arguments: { city: "SP" } }] },
        { role: "tool", parts: [{ type: "tool_result", toolCallId: "c1", content: "sunny" }] },
      ]),
    ).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "weather", arguments: '{"city":"SP"}' } }],
      },
      { role: "tool", tool_call_id: "c1", content: "sunny" },
    ]);
  });
});
