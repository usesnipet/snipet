import { Owner } from "#src/common/decorators/owner.decorator.js";
import { ToolResult } from "#src/plugin/driver.js";
import { isGranted } from "#src/utils/grant/grant.js";
import { BadRequestException, Injectable } from "@nestjs/common";

import { Agent } from "../agent/agent.entity.js";
import { PluginConnectionService } from "../plugin-connection/plugin-connection.service.js";

import type { LlmMessage, LlmTool, LlmToolCallPart } from "@snipet/shared";

type Executor = (args: Record<string, unknown>) => Promise<ToolResult>;
type ToolSource = { id: string; name: string };
export type DeniedTool = { tool: string; pluginConnectionId: string };

/** What one run gives the models: system messages and tools, and how to run their calls. */
export type RunContext = {
  /** The agent's name and prompt, then the instructions of its plugins. */
  system: LlmMessage[];
  tools?: LlmTool[];
  denied: DeniedTool[];
  /** Instructions of the plugin connections with at least one granted tool. */
  instructions: { name: string; text: string }[];
  has(name: string): boolean;
  /** The plugin connection a tool comes from; null for an unknown tool. */
  toolOf(name: string): { id: string; name: string } | null;
  /** Never throws: an unknown tool or a failed tool is an error result. */
  call(call: LlmToolCallPart): Promise<ToolResult>;
};

/** A failed tool's error as the model sees it; validation details let it fix its arguments. */
function describeToolError(err: unknown): string {
  if (err instanceof BadRequestException) return JSON.stringify(err.getResponse());
  return err instanceof Error ? err.message : String(err);
}

/** Keeps a connection name from closing the attribute or tag it is put in. */
const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const systemText = (text: string): LlmMessage => ({ role: "system", parts: [{ type: "text", text }] });

/** Builds a run's context from the agent and its plugin connections; plugin tools become LLM tools. */
@Injectable()
export class AgentContext {
  constructor(private readonly plugins: PluginConnectionService) {}

  /**
   * The tools of the agent's plugin connections that pass the
   * grant's allow/deny; the others are returned as denied. Names are made
   * unique and provider-safe; executors maps them back.
   */
  async build(agent: Agent, owner: Owner): Promise<RunContext> {
    const denied: DeniedTool[] = [];
    const executors = new Map<string, Executor>();
    const sources = new Map<string, ToolSource>();
    const tools: LlmTool[] = [];
    const add = (
      rawName: string,
      description: string,
      parameters: Record<string, unknown>,
      source: ToolSource,
      execute: Executor,
    ) => {
      const base = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      let name = base;
      for (let n = 2; executors.has(name); n++) name = `${base}_${n}`;
      executors.set(name, execute);
      sources.set(name, source);
      tools.push({ name, description, parameters });
    };

    const pluginGrants = new Map((agent.pluginConnections ?? []).map((g) => [g.pluginConnectionId, g]));
    const used = new Set<string>();
    for (const tool of await this.plugins.findTools([...pluginGrants.keys()])) {
      if (!isGranted(tool.name, pluginGrants.get(tool.pluginConnectionId)!)) {
        denied.push({ tool: tool.name, pluginConnectionId: tool.pluginConnectionId });
        continue;
      }
      used.add(tool.pluginConnectionId);
      const description = `[${tool.pluginConnection!.name}] ${tool.description}`.trim();
      const source = { id: tool.pluginConnectionId, name: tool.pluginConnection!.name };
      add(tool.name, description, tool.inputSchema, source, (args) => this.plugins.executeTool(tool.id, args));
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
      toolOf: (name) => sources.get(name) ?? null,
      call: async (call) => {
        const execute = executors.get(call.name);
        if (!execute) return { content: `unknown tool "${call.name}"`, isError: true };
        try {
          return await execute((call.arguments ?? {}) as Record<string, unknown>);
        } catch (err) {
          return { content: describeToolError(err), isError: true };
        }
      },
    };
  }
}
