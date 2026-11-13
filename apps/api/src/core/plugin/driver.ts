import type { BaseDriver } from "#src/core/manifest/driver.js";
import type { HealthCheckDriver } from "#src/core/manifest/health-check.js";
import type { JsonObject } from "@snipet/shared";
import type { HookEvent, HookName, HookResult, LLMTool, LLMToolResult } from "@snipet/shared/core";

export interface ToolDriver<Opts = unknown> extends BaseDriver<Opts> {
  listTools(options: Opts): Promise<LLMTool[]>;
  callTool(name: string, parameters: Record<string, unknown>, options: Opts): Promise<LLMToolResult>;
}

export interface InstructionsDriver<Opts = unknown> extends BaseDriver<Opts> {
  /** How to use the plugin, or undefined when it has none. */
  getInstructions(options: Opts): Promise<string | undefined>;
}

/** What a hook handler gets besides the event and the manifest's options. */
export interface HookContext {
  /** The agent's settings for the plugin, validated, secrets unsealed. */
  settings: JsonObject;
  /** The plugin's run state; a reply's `state` is merged into it. */
  state: JsonObject;
  /** Aborts on timeout or when another handler ended the step. */
  signal: AbortSignal;
}

export interface HookDriver<Opts = unknown> extends BaseDriver<Opts> {
  /** The hooks it implements. */
  readonly hooks: readonly HookName[];
  /** Throws on failure, timeout (`signal`) or an invalid reply. */
  handle(event: HookEvent, options: Opts, context: HookContext): Promise<HookResult>;
}

/** Driver per capability, keyed by the manifest field that names it. */
export type PluginDrivers = {
  tools: ToolDriver;
  instructions: InstructionsDriver;
  hooks: HookDriver;
  healthCheck: HealthCheckDriver;
};
