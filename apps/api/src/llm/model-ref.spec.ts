import { LlmError } from "./errors.js";
import { splitModelRef } from "./model-ref.js";

describe("splitModelRef", () => {
  it("splits on the first slash", () => {
    expect(splitModelRef("openai/gpt-4o")).toEqual(["openai", "gpt-4o"]);
    expect(splitModelRef("openrouter/meta/llama-3")).toEqual(["openrouter", "meta/llama-3"]);
  });

  it.each(["gpt-4o", "/gpt-4o", "openai/"])("rejects %s", (ref) => {
    expect(() => splitModelRef(ref)).toThrow(LlmError);
  });
});
