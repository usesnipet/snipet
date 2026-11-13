import { FailoverError } from "#src/core/llm/errors.js";
import { LLMManifestRegistry } from "#src/core/llm/llm.registry.js";
import { LLMRunner } from "#src/core/llm/llm.runner.js";
import { Test } from "@nestjs/testing";
import { LLMMessagePartType, LLMRole } from "@snipet/shared/core";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { LLMModule } from "./llm.module.js";

describe("LLMModule", () => {
  it("wires the core classes and loads every built-in manifest", async () => {
    const app = await Test.createTestingModule({ imports: [LLMModule] }).compile();

    // LLMRunner has no @Injectable: as a plain provider its registries would be
    // undefined and this would throw a TypeError instead of failing over.
    const messages = [{ role: LLMRole.USER, parts: [{ type: LLMMessagePartType.TEXT as const, text: "hi" }] }];
    await expect(
      app
        .get(LLMRunner)
        .generate({ targets: [{ status: "success", llm: "nope", model: "m", connection: {} }], messages }),
    ).rejects.toBeInstanceOf(FailoverError);
    const builtIn = readdirSync(resolve(import.meta.dirname, "manifests"));
    expect(app.get(LLMManifestRegistry).getAll().length).toBeGreaterThanOrEqual(builtIn.length);
  });
});
