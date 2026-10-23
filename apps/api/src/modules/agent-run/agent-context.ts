import { Owner } from "#src/common/decorators/owner.decorator.js";
import { ActionResult } from "#src/plugin/driver.js";
import { isGranted } from "#src/utils/grant/grant.js";
import { Injectable } from "@nestjs/common";

import { Agent } from "../agent/agent.entity.js";
import { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";

import type { LlmMessage, LlmTool, LlmToolCallPart } from "@snipet/shared";

type Executor = (args: Record<string, unknown>) => Promise<ActionResult>;
export type DeniedAction = { action: string; pluginConnectionId: string };

/** What one run gives the models: system messages and tools, and how to run their calls. */
export type RunContext = {
  /** The agent's name and prompt, then the instructions of its plugins. */
  system: LlmMessage[];
  tools?: LlmTool[];
  denied: DeniedAction[];
  /** Instructions of the plugin connections with at least one granted action. */
  instructions: { name: string; text: string }[];
  has(name: string): boolean;
  /** Never throws: an unknown tool or a failed action is an error result. */
  call(call: LlmToolCallPart): Promise<ActionResult>;
};

/** Keeps a connection name from closing the attribute or tag it is put in. */
const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const systemText = (text: string): LlmMessage => ({ role: "system", parts: [{ type: "text", text }] });

/** Builds a run's context from the agent and its plugin connections; plugin actions become LLM tools. */
@Injectable()
export class AgentContext {
  constructor(private readonly plugins: PluginConnectionService) {}

  /**
   * The tools of the agent's actions of its plugin connections that pass the
   * grant's allow/deny; the others are returned as denied. Names are made
   * unique and provider-safe; executors maps them back.
   */
  async build(agent: Agent, owner: Owner): Promise<RunContext> {
    const denied: DeniedAction[] = [];
    const executors = new Map<string, Executor>();
    const tools: LlmTool[] = [];
    const add = (rawName: string, description: string, parameters: Record<string, unknown>, execute: Executor) => {
      const base = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      let name = base;
      for (let n = 2; executors.has(name); n++) name = `${base}_${n}`;
      executors.set(name, execute);
      tools.push({ name, description, parameters });
    };

    const pluginGrants = new Map((agent.pluginConnections ?? []).map((g) => [g.pluginConnectionId, g]));
    const used = new Set<string>();
    for (const action of await this.plugins.findActions([...pluginGrants.keys()])) {
      if (!isGranted(action.name, pluginGrants.get(action.pluginConnectionId)!)) {
        denied.push({ action: action.name, pluginConnectionId: action.pluginConnectionId });
        continue;
      }
      used.add(action.pluginConnectionId);
      const description = `[${action.pluginConnection!.name}] ${action.description}`.trim();
      add(action.name, description, action.inputSchema, (args) => this.plugins.executeAction(action.id, args));
    }

    const instructions = await this.plugins.findInstructions([...used]);
    const system = [systemText(`Your name is ${agent.name}`)];
    if (owner.name) system.push(systemText(`The user's name is ${owner.name}`));
    if (agent.systemPrompt) system.push(systemText(agent.systemPrompt));
    for (const { name, text } of instructions) {
      system.push(systemText(`<plugin name="${escapeAttr(name)}">\n${text}\n</plugin>`));
    }

    return {
      system,
      tools: tools.length ? tools : undefined,
      denied,
      instructions,
      has: (name) => executors.has(name),
      call: async (call) => {
        const execute = executors.get(call.name);
        if (!execute) return { content: `unknown tool "${call.name}"`, isError: true };
        try {
          return await execute((call.arguments ?? {}) as Record<string, unknown>);
        } catch (err) {
          return { content: err instanceof Error ? err.message : String(err), isError: true };
        }
      },
    };
  }
}
