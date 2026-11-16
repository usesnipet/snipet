import { AppContext } from "#src/common/context/app-context.js";
import { ModelPricesService } from "#src/modules/usage/model-prices.service.js";
import { UsageRecord } from "#src/modules/usage/usage-record.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { EntityManager } from "typeorm";

import type { LLMCall, UsageStore } from "#src/core/store/usage.store.js";
import type { Agent, AgentRun } from "@snipet/shared";

/**
 * The core's UsageStore on the usage_records table. Each call keeps its model's prices of
 * that moment; they stay null when the price list doesn't have the model.
 */
@Injectable()
export class DatabaseUsageStore extends BaseService<AppContext> implements UsageStore {
  constructor(
    protected readonly manager: EntityManager,
    private readonly modelPricesService: ModelPricesService,
  ) {
    super(manager);
  }

  async record(ctx: AppContext, agent: Agent, run: AgentRun, { connectionId, model, usage }: LLMCall): Promise<void> {
    const { userId, appId, externalUserId } = ctx.owner;
    const price = this.modelPricesService.find(model);
    await this.repositoryOf(ctx, UsageRecord).insert({
      agentId: agent.id,
      sessionId: run.sessionId,
      runId: run.id,
      userId,
      appId,
      externalUserId,
      connectionId,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens ?? 0,
      inputPrice: price?.inputPrice ?? null,
      outputPrice: price?.outputPrice ?? null,
      cachedInputPrice: price?.cachedInputPrice ?? null,
    });
  }
}
