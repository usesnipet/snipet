import { ActionResult } from "#src/plugin/driver.js";
import { isGranted } from "#src/utils/grant/grant.js";
import { Injectable } from "@nestjs/common";

import { Agent } from "../agent/agent.entity.js";
import { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";

import type { LlmTool, LlmToolCallPart } from "@snipet/shared";

type Executor = (args: Record<string, unknown>) => Promise<ActionResult>;
export type DeniedAction = { action: string; pluginConnectionId: string };

/** The tools of one run: what the models are offered, and how to run their calls. */
export type AgentToolSet = {
  tools?: LlmTool[];
  denied: DeniedAction[];
  /** Instructions of the plugin connections with at least one granted action. */
  instructions: { name: string; text: string }[];
  has(name: string): boolean;
  /** Never throws: an unknown tool or a failed action is an error result. */
  call(call: LlmToolCallPart): Promise<ActionResult>;
};

@Injectable()
export class AgentTools {
  constructor(private readonly plugins: PluginConnectionService) {}

  /**
   * The tools of the agent's actions of its plugin connections that pass the
   * grant's allow/deny; the others are returned as denied. Names are made
   * unique and provider-safe; executors maps them back.
   */
  async resolve(agent: Agent): Promise<AgentToolSet> {
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
      add(action.name, action.description, action.inputSchema, (args) => this.plugins.executeAction(action.id, args));
    }

    return {
      tools: tools.length ? tools : undefined,
      denied,
      instructions: await this.plugins.findInstructions([...used]),
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
