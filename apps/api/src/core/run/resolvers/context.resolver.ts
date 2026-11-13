import { LLMMessagePartType, LLMRole } from "@snipet/shared/core";

import type { Agent } from "@snipet/shared";
import type { LLMMessage } from "@snipet/shared/core";
import type { CoreContext } from "../../context.js";
import type { PluginInstructions } from "./plugin.resolver.js";

/** What the system messages are built from. */
type ContextResolverOptions = {
  agent: Agent;
  instructions: PluginInstructions[];
};

/** Keeps a connection name from closing the attribute or tag it is put in. */
const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const systemText = (text: string): LLMMessage => ({
  role: LLMRole.SYSTEM,
  parts: [{ type: LLMMessagePartType.TEXT, text }],
});

/** The system messages of a run: the agent's name and prompt, the user's name, then its plugins' instructions. */
export class ContextResolver {
  resolve(ctx: CoreContext, { agent, instructions }: ContextResolverOptions): LLMMessage[] {
    const system = [systemText(`Your name is ${agent.name}`)];
    if (ctx.owner.name) system.push(systemText(`The user's name is ${ctx.owner.name}`));
    if (agent.systemPrompt) system.push(systemText(agent.systemPrompt));
    for (const { source, text } of instructions) {
      system.push(systemText(`<plugin name="${escapeAttr(source.name)}">\n${text}\n</plugin>`));
    }
    return system;
  }
}
