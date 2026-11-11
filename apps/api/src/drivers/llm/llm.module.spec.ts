import { Test } from "@nestjs/testing";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { FailoverError } from "#src/core/llm/errors.js";
import { LLMManifestRegistry } from "#src/core/llm/llm.registry.js";
import { LLMRunner } from "#src/core/llm/llm.runner.js";

import { LLMModule } from "./llm.module.js";

describe("LLMModule", () => {
  it("wires the core classes and loads every built-in manifest", async () => {
    const app = await Test.createTestingModule({ imports: [LLMModule] }).compile();

    // LLMRunner has no @Injectable: as a plain provider its registries would be
    // undefined and this would throw a TypeError instead of failing over.
    const messages = [{ role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] }];
    await expect(
      app.get(LLMRunner).generate({ targets: [{ llm: "nope", model: "m", connection: {} }], messages }),
    ).rejects.toBeInstanceOf(FailoverError);
    const builtIn = readdirSync(resolve(import.meta.dirname, "manifests"));
    expect(app.get(LLMManifestRegistry).getAll().length).toBeGreaterThanOrEqual(builtIn.length);
  });
});
