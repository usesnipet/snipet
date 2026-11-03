import { PluginDriverRegistry } from "#src/plugin/plugin.registry.js";
import { Injectable, Logger } from "@nestjs/common";
import { hookHandlersOf } from "@snipet/shared";

import { PluginConnectionService } from "../../plugin-connection/plugin-connection.service.js";

import { HookRunner } from "./hook.runner.js";

import type { BoundHandler, HookRunnerContext } from "./hook.runner.js";

/** Builds the hook runner of each run from the hooks of the agent's plugins. */
@Injectable()
export class HookDispatcher {
  private readonly logger = new Logger(HookDispatcher.name);

  constructor(
    private readonly plugins: PluginConnectionService,
    private readonly drivers: PluginDriverRegistry,
  ) {}

  /**
   * The run's hook runner, with the handlers of the agent's enabled plugin
   * connections in plugin order, minus the optional ones the agent turned
   * off. Never throws, so loading hooks can't fail the run: a plugin that
   * fails to load is logged and left out.
   */
  async forRun(context: HookRunnerContext): Promise<HookRunner> {
    const grants = [...(context.agent.pluginConnections ?? [])].sort((a, b) => a.position - b.position);
    const handlers: BoundHandler[] = [];
    try {
      const conns = await this.plugins.findEnabled(grants.map((g) => g.pluginConnectionId));
      for (const grant of grants) {
        const conn = conns.get(grant.pluginConnectionId);
        if (!conn) continue;
        try {
          const manifest = this.plugins.getManifest(conn.pluginKey);
          const resolved = this.drivers.resolve(manifest, "hooks", conn.config);
          if (!resolved) continue;
          for (const [hook, handler] of hookHandlersOf(manifest.capabilities.hooks!)) {
            if (handler.optional && grant.disabledHooks.includes(hook)) continue;
            const plugin = { id: conn.id, name: conn.name };
            handlers.push({ plugin, hook, handler, ...resolved, settings: grant.settings ?? {} });
          }
        } catch (err) {
          this.logger.warn(`hooks of plugin connection ${conn.id}: ${String(err)}`);
        }
      }
    } catch (err) {
      this.logger.warn(`hooks of agent ${context.agent.id}: ${String(err)}`);
    }
    return new HookRunner(handlers, context, this.logger);
  }
}
