import type { BaseDriver } from "#src/manifest/driver.js";
import type { HealthCheckDriver } from "#src/manifest/health-check.js";

/** An action as listed by a driver. */
export interface Action {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** The outcome of an action call, flattened to text. */
export interface ActionResult {
  content: string;
  isError: boolean;
}

export interface ActionDriver<Opts = unknown> extends BaseDriver<Opts> {
  listActions(connectionId: string, options: Opts): Promise<Action[]>;
  callAction(
    connectionId: string,
    name: string,
    parameters: Record<string, unknown>,
    options: Opts,
  ): Promise<ActionResult>;
}

export interface InstructionsDriver<Opts = unknown> extends BaseDriver<Opts> {
  /** How to use the plugin, or undefined when it has none. */
  getInstructions(connectionId: string, options: Opts): Promise<string | undefined>;
}

/** Driver per capability, keyed by the manifest field that names it. */
export type PluginDrivers = {
  actions: ActionDriver;
  instructions: InstructionsDriver;
  healthCheck: HealthCheckDriver;
};
