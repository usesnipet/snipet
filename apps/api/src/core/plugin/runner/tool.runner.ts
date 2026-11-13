import { CoreError } from "../../error.js";

import type { LLMMessageToolCallPart, LLMTool, LLMToolResult } from "@snipet/shared/core";

/** The plugin connection something comes from. */
export type PluginSource = { id: string; name: string };

/** A granted tool as its plugin lists it, and how to run it. */
export interface PluginTool {
  tool: LLMTool;
  source: PluginSource;
  /** Validates the arguments against the tool's schema; throws on bad ones or an unreachable service. */
  execute(args: Record<string, unknown>): Promise<LLMToolResult>;
}

/** A failed tool's error as the model sees it; validation details let it fix its arguments. */
function describeToolError(err: unknown): string {
  if (err instanceof CoreError && err.details !== undefined) {
    return JSON.stringify({ message: err.message, details: err.details });
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * The tools of one run. Names are made unique and provider-safe, and calls are
 * mapped back to the plugin tool they stand for.
 */
export class ToolRunner {
  /** As the models see them, sorted by name then plugin connection so prompts stay cacheable. */
  readonly tools: LLMTool[] = [];
  private readonly byName = new Map<string, PluginTool>();

  constructor(pluginTools: PluginTool[]) {
    const sorted = pluginTools.toSorted(
      (a, b) => a.tool.name.localeCompare(b.tool.name) || a.source.id.localeCompare(b.source.id),
    );
    for (const pluginTool of sorted) {
      const base = pluginTool.tool.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      let name = base;
      for (let n = 2; this.byName.has(name); n++) name = `${base}_${n}`;
      this.byName.set(name, pluginTool);
      const description = `[${pluginTool.source.name}] ${pluginTool.tool.description}`.trim();
      this.tools.push({ ...pluginTool.tool, name, description });
    }
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  /** The plugin connection a tool comes from; null for an unknown tool. */
  sourceOf(name: string): PluginSource | null {
    return this.byName.get(name)?.source ?? null;
  }

  /** Never throws: an unknown tool or a failed tool is an error result. */
  async call(call: LLMMessageToolCallPart): Promise<LLMToolResult> {
    const pluginTool = this.byName.get(call.name);
    if (!pluginTool) return { content: `unknown tool "${call.name}"`, isError: true };
    try {
      return await pluginTool.execute((call.arguments ?? {}) as Record<string, unknown>);
    } catch (err) {
      return { content: describeToolError(err), isError: true };
    }
  }
}
