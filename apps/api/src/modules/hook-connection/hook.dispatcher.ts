import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { AgentHook } from "../agent/agent.entity.js";

import { HookConnectionService } from "./hook-connection.service.js";
import { ASYNC_TIMEOUT_MS, HookHandler, HookRunner, HookRunnerContext, SYNC_TIMEOUT_MS } from "./hook.runner.js";

@Injectable()
export class HookDispatcher {
  private readonly logger = new Logger(HookDispatcher.name);

  constructor(
    @InjectRepository(AgentHook) private readonly bindings: Repository<AgentHook>,
    private readonly connections: HookConnectionService,
  ) {}

  /**
   * The run's enabled hooks, loaded once: global ones first, then the
   * agent's, each group by stage and position. Never throws: a hook that can't load is
   * logged and left out, so it can't fail the run.
   */
  async forRun(ctx: HookRunnerContext): Promise<HookRunner> {
    let bindings: AgentHook[] = [];
    try {
      const enabled = { enabled: true, hookConnection: { enabled: true } };
      bindings = await this.bindings.find({
        where: [
          { ...enabled, agentId: IsNull() },
          { ...enabled, agentId: ctx.agent.id },
        ],
        relations: { hookConnection: true },
        order: { stage: "ASC", position: "ASC", createdAt: "ASC" },
      });
    } catch (err) {
      this.logger.warn(`load hooks of run ${ctx.run.id}: ${String(err)}`);
    }
    // Stable sort: keeps the order within each group.
    bindings.sort((a, b) => Number(a.agentId !== null) - Number(b.agentId !== null));

    const handlers = bindings.flatMap((b): HookHandler[] => {
      const conn = b.hookConnection!;
      try {
        const { driver, options } = this.connections.handlerOf(conn);
        const timeoutMs = b.timeoutMs ?? (b.async ? ASYNC_TIMEOUT_MS : SYNC_TIMEOUT_MS);
        const { event, stage, match, async, onError } = b;
        return [
          {
            name: conn.name,
            event,
            global: b.agentId === null,
            stage,
            match,
            async,
            onError,
            driver,
            options,
            timeoutMs,
          },
        ];
      } catch (err) {
        this.logger.warn(`hook connection ${conn.id} (${conn.hookKey}): ${String(err)}`);
        return [];
      }
    });
    return new HookRunner(handlers, ctx, this.logger);
  }
}
