import { LLMMessagePartType, LLMRole } from "@snipet/shared/core";

import { ContextResolver } from "./context.resolver.js";

import type { Agent } from "@snipet/shared";
import type { CoreContext } from "../../context.js";

const ctxOf = (name: string | null) =>
  ({ owner: { userId: "u1", appId: null, externalUserId: null, name }, requestId: "q1" }) as CoreContext;
const text = (value: string) => ({ role: LLMRole.SYSTEM, parts: [{ type: LLMMessagePartType.TEXT, text: value }] });

describe("ContextResolver", () => {
  const resolver = new ContextResolver();

  it("names the agent and the user, then gives the prompt and each plugin's instructions", () => {
    const agent = { name: "Bot", systemPrompt: "Be brief." } as Agent;
    const instructions = [{ source: { id: "c1", name: 'Git"Hub<' }, text: "use search" }];
    expect(resolver.resolve(ctxOf("Ana"), { agent, instructions })).toEqual([
      text("Your name is Bot"),
      text("The user's name is Ana"),
      text("Be brief."),
      text('<plugin name="Git&quot;Hub&lt;">\nuse search\n</plugin>'),
    ]);
  });

  it("leaves out an unknown user name and an empty prompt", () => {
    const agent = { name: "Bot", systemPrompt: "" } as Agent;
    expect(resolver.resolve(ctxOf(null), { agent, instructions: [] })).toEqual([text("Your name is Bot")]);
  });
});
