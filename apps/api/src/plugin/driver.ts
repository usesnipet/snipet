import type { BaseDriver } from "#src/manifest/driver.js";
import type { HealthCheckDriver } from "#src/manifest/health-check.js";
import type { HookEvent, HookName, HookResult, JsonObject } from "@snipet/shared";

/** A tool as listed by a driver. */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** The outcome of a tool call, flattened to text. */
export interface ToolResult {
  content: string;
  isError: boolean;
  /** Set when the call timed out; never sent to the model. */
  timedOut?: boolean;
}

export interface ToolDriver<Opts = unknown> extends BaseDriver<Opts> {
  listTools(connectionId: string, options: Opts): Promise<Tool[]>;
  callTool(connectionId: string, name: string, parameters: Record<string, unknown>, options: Opts): Promise<ToolResult>;
}

export interface InstructionsDriver<Opts = unknown> extends BaseDriver<Opts> {
  /** How to use the plugin, or undefined when it has none. */
  getInstructions(connectionId: string, options: Opts): Promise<string | undefined>;
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
