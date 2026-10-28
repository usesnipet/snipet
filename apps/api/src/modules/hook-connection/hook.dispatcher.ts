import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DEFAULT_ASYNC_HOOK_TIMEOUT_MS, DEFAULT_SYNC_HOOK_TIMEOUT_MS } from "@snipet/shared";
import { IsNull, Repository } from "typeorm";

import { AgentHook } from "../agent/agent.entity.js";

import { HookConnectionService } from "./hook-connection.service.js";
import { HookRunner } from "./hook.runner.js";

import type { HookHandler, HookRunnerContext } from "./hook.runner.js";

/** Global hooks first: false (0) sorts before true (1). */
const byAgentScope = (left: AgentHook, right: AgentHook): number =>
  Number(left.agentId !== null) - Number(right.agentId !== null);

@Injectable()
export class HookDispatcher {
  private readonly logger = new Logger(HookDispatcher.name);

  constructor(
    @InjectRepository(AgentHook) private readonly agentHooks: Repository<AgentHook>,
    private readonly connections: HookConnectionService,
  ) {}

  /**
   * The run's enabled hooks, loaded once: global ones first, then the
   * agent's, each group by stage and position. Never throws: a hook that can't load is
   * logged and left out, so it can't fail the run.
   */
  async forRun(context: HookRunnerContext): Promise<HookRunner> {
    const agentHooks = await this.loadEnabled(context);
    // Stable sort: keeps the stage order within each group.
    agentHooks.sort(byAgentScope);
    const handlers = agentHooks.flatMap((agentHook): HookHandler[] => {
      const handler = this.toHandler(agentHook);
      return handler ? [handler] : [];
    });
    return new HookRunner(handlers, context, this.logger);
  }

  /** Enabled bindings of the run's agent and global ones, on enabled connections; empty when the query fails. */
  private async loadEnabled({ run, agent }: HookRunnerContext): Promise<AgentHook[]> {
    const enabled = { enabled: true, hookConnection: { enabled: true } };
    try {
      return await this.agentHooks.find({
        where: [
          { ...enabled, agentId: IsNull() },
          { ...enabled, agentId: agent.id },
        ],
        relations: { hookConnection: true },
        order: { stage: "ASC", position: "ASC", createdAt: "ASC" },
      });
    } catch (err) {
      this.logger.warn(`load hooks of run ${run.id}: ${String(err)}`);
      return [];
    }
  }

  /** The binding with its connection's driver resolved; undefined when the connection no longer resolves. */
  private toHandler(agentHook: AgentHook): HookHandler | undefined {
    const connection = agentHook.hookConnection!;
    const { event, stage, match, async, onError } = agentHook;
    try {
      const { driver, options } = this.connections.handlerOf(connection);
      return {
        name: connection.name,
        event,
        global: agentHook.agentId === null,
        stage,
        match,
        async,
        onError,
        driver,
        options,
        timeoutMs: agentHook.timeoutMs ?? (async ? DEFAULT_ASYNC_HOOK_TIMEOUT_MS : DEFAULT_SYNC_HOOK_TIMEOUT_MS),
      };
    } catch (err) {
      this.logger.warn(`hook connection ${connection.id} (${connection.hookKey}): ${String(err)}`);
      return undefined;
    }
  }
}
