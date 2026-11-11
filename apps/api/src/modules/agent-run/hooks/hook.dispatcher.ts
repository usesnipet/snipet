import { PluginDriverRegistry } from "#src/core/plugin/plugin.registry.js";
import { Injectable, Logger } from "@nestjs/common";
import { hookHandlersOf } from "@snipet/shared";

import { PluginConnectionService } from "../../plugin-connection/plugin-connection.service.js";

import { HookRunner } from "./hook.runner.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { Agent } from "../../agent/agent.entity.js";
import type { AgentRun } from "../agent-run.entity.js";
import type { BoundHandler } from "./hook.runner.js";

/** Builds the hook runner of each run from the hooks of the agent's plugins. */
@Injectable()
export class HookDispatcher {
  private readonly logger = new Logger(HookDispatcher.name);

  constructor(
    private readonly pluginConnectionService: PluginConnectionService,
    private readonly pluginDriverRegistry: PluginDriverRegistry,
  ) {}

  /**
   * The run's hook runner, with the handlers of the agent's enabled plugin
   * connections in plugin order, minus the optional ones the agent turned
   * off. Never throws, so loading hooks can't fail the run: a plugin that
   * fails to load is logged and left out.
   */
  async forRun(ctx: AppContext, run: AgentRun, agent: Agent): Promise<HookRunner> {
    const grants = [...(agent.pluginConnections ?? [])].sort((a, b) => a.position - b.position);
    const handlers: BoundHandler[] = [];
    try {
      const conns = await this.pluginConnectionService.findEnabled(
        ctx,
        grants.map((g) => g.pluginConnectionId),
      );
      for (const grant of grants) {
        const conn = conns.get(grant.pluginConnectionId);
        if (!conn) continue;
        try {
          const manifest = this.pluginConnectionService.getManifest(ctx, conn.pluginKey);
          const resolved = this.pluginDriverRegistry.resolve(manifest, "hooks", conn.config);
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
      this.logger.warn(`hooks of agent ${agent.id}: ${String(err)}`);
    }
    return new HookRunner(handlers, { run, agent, owner: ctx.owner }, this.logger);
  }
}
