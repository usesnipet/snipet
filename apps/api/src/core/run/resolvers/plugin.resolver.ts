import { parseJsonSchema } from "../../json-schema/json-schema.js";
import { HookRunner } from "../../plugin/runner/hook.runner.js";
import { ToolRunner } from "../../plugin/runner/tool.runner.js";

import type { Agent, AgentPluginConnection, AgentRun } from "@snipet/shared";
import type { HookHandler, HookName, PluginManifest } from "@snipet/shared/core";
import type { CoreContext } from "../../context.js";
import type { Logger } from "../../logger.js";
import type { PluginDriverRegistry, PluginManifestRegistry } from "../../plugin/plugin.registry.js";
import type { BoundHandler } from "../../plugin/runner/hook.runner.js";
import type { PluginSource, PluginTool } from "../../plugin/runner/tool.runner.js";
import type { PluginConnectionStore, RunPluginConnection } from "../../store/plugin-connection.store.js";

/** What the plugins are resolved for. */
type PluginResolverOptions = {
  agent: Agent;
  run: AgentRun;
};

/** A synced tool the grant leaves out. */
export type DeniedTool = { tool: string; pluginConnectionId: string };

/** A plugin connection's instructions, for the system messages. */
export type PluginInstructions = { source: PluginSource; text: string };

/** What the agent's plugins bring to a run. */
export interface RunPlugins {
  tools: ToolRunner;
  hooks: HookRunner;
  denied: DeniedTool[];
  /** Of the connections with at least one granted tool, by connection id so prompts stay cacheable. */
  instructions: PluginInstructions[];
}

/**
 * Loads the agent's enabled plugin connections once, at the start of a run,
 * so the run works on a snapshot. A connection whose drivers fail to resolve
 * is logged and left out rather than failing the run.
 */
export class PluginResolver {
  constructor(
    private readonly pluginConnectionStore: PluginConnectionStore,
    private readonly pluginManifestRegistry: PluginManifestRegistry,
    private readonly pluginDriverRegistry: PluginDriverRegistry,
    private readonly logger: Logger,
  ) {}

  async resolve(ctx: CoreContext, { agent, run }: PluginResolverOptions): Promise<RunPlugins> {
    const grants = agent.pluginConnections.toSorted((a, b) => a.position - b.position);
    const connections = await this.pluginConnectionStore.findEnabled(
      ctx,
      grants.map((grant) => grant.pluginConnectionId),
    );
    const tools: PluginTool[] = [];
    const handlers: BoundHandler[] = [];
    const denied: DeniedTool[] = [];
    const instructions: PluginInstructions[] = [];
    for (const grant of grants) {
      const connection = connections.get(grant.pluginConnectionId);
      if (!connection) continue;
      const manifest = this.pluginManifestRegistry.find(connection.pluginKey);
      if (!manifest) {
        this.logger.warn(`plugin connection ${connection.id}: plugin "${connection.pluginKey}" not in the catalog`);
        continue;
      }
      try {
        // Both resolve their drivers before anything is added, so a failing connection adds nothing.
        const connectionHandlers = this.handlersOf(manifest, connection, grant);
        const granted = this.toolsOf(manifest, connection, grant, denied);
        handlers.push(...connectionHandlers);
        tools.push(...granted);
        if (granted.length && connection.instructions) {
          instructions.push({ source: granted[0].source, text: connection.instructions });
        }
      } catch (err) {
        this.logger.warn(`plugin connection ${connection.id}: ${String(err)}`);
      }
    }
    instructions.sort((a, b) => a.source.id.localeCompare(b.source.id));
    return {
      tools: new ToolRunner(tools),
      hooks: new HookRunner(handlers, { run, agent, owner: ctx.owner }, this.logger),
      denied,
      instructions,
    };
  }

  /** The connection's granted tools; the others go to `denied`. */
  private toolsOf(
    manifest: PluginManifest,
    connection: RunPluginConnection,
    grant: AgentPluginConnection,
    denied: DeniedTool[],
  ): PluginTool[] {
    const resolved = this.pluginDriverRegistry.resolve(manifest, "tools", connection.config);
    if (!resolved) return [];
    const { driver, options } = resolved;
    const source = { id: connection.id, name: connection.name };
    const granted: PluginTool[] = [];
    for (const tool of connection.tools) {
      if (!grant.tools.includes(tool.name)) {
        denied.push({ tool: tool.name, pluginConnectionId: connection.id });
        continue;
      }
      granted.push({
        tool,
        source,
        execute: (args) => driver.callTool(tool.name, parseJsonSchema(tool.inputSchema, args), options),
      });
    }
    return granted;
  }

  /** The connection's hook handlers, minus the optional ones the agent turned off. */
  private handlersOf(
    manifest: PluginManifest,
    connection: RunPluginConnection,
    grant: AgentPluginConnection,
  ): BoundHandler[] {
    const capability = manifest.capabilities.hooks;
    const resolved = this.pluginDriverRegistry.resolve(manifest, "hooks", connection.config);
    if (!capability || !resolved) return [];
    const plugin = { id: connection.id, name: connection.name };
    return (Object.entries(capability.handlers) as [HookName, HookHandler][])
      .filter(([hook, handler]) => !(handler.optional && grant.disabledHooks.includes(hook)))
      .map(([hook, handler]) => ({ plugin, hook, handler, ...resolved, settings: grant.settings ?? {} }));
  }
}
