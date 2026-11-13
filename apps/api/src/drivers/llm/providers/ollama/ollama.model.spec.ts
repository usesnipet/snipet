import { LLMCapability } from "@snipet/shared/core";

import { toLlmModel } from "./ollama.model.js";

describe("ollama toLlmModel", () => {
  it("maps capabilities and context length", () => {
    expect(
      toLlmModel("llama3.2:latest", {
        capabilities: ["completion", "tools", "insert"],
        model_info: { "general.architecture": "llama", "llama.context_length": 131072 },
      }),
    ).toEqual({
      key: "llama3.2:latest",
      name: "llama3.2:latest",
      description: "",
      capabilities: [LLMCapability.TEXT, LLMCapability.TOOLS],
      contextWindow: 131072,
    });
  });

  it("defaults when show has no data", () => {
    expect(toLlmModel("x", {})).toMatchObject({ capabilities: [], contextWindow: 0 });
  });
});
