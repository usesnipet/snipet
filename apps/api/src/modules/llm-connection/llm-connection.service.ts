import { ConnectionService } from "#src/common/connection-sync/connection.service.js";
import { CoreError, CoreErrorCode } from "#src/core/error.js";
import { LLMError, LLMErrorCode } from "#src/core/llm/errors.js";
import { LLMDriverRegistry, LLMManifestRegistry } from "#src/core/llm/llm.registry.js";
import { LLMRunner, LLMTarget } from "#src/core/llm/llm.runner.js";
import { Injectable } from "@nestjs/common";
import { DeepPartial, EntityManager, QueryDeepPartialEntity } from "typeorm";

import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionSyncService } from "./sync/llm-connection-sync.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { LLMDrivers } from "#src/core/llm/driver.js";
import type { ExecuteLlm, ExecuteLlmTarget, LlmManifest, LlmModel, LlmResponse, LlmStreamEvent } from "@snipet/shared";

/**
 * Service for managing LLM connections and running conversations.
 */
@Injectable()
export class LlmConnectionService extends ConnectionService<LlmConnection, LlmManifest, LLMDrivers> {
  protected readonly keyField = "llmKey";

  constructor(
    manager: EntityManager,
    llms: LLMManifestRegistry,
    drivers: LLMDriverRegistry,
    private readonly syncer: LlmConnectionSyncService,
    private readonly runner: LLMRunner,
  ) {
    super(manager, LlmConnection, llms, drivers);
  }

  override async create(ctx: AppContext, dto: DeepPartial<LlmConnection>): Promise<LlmConnection> {
    const { id } = await super.create(ctx, dto);
    void this.syncer.sync(ctx, id);
    return this.findById(ctx, id);
  }

  override async updateById(ctx: AppContext, id: string, dto: QueryDeepPartialEntity<LlmConnection>): Promise<void> {
    await super.updateById(ctx, id, dto);
    if (dto.llmKey !== undefined || dto.config !== undefined) void this.syncer.sync(ctx, id);
  }

  sync(ctx: AppContext, id: string): Promise<void> {
    return this.syncer.sync(ctx, id);
  }

  /** The connection's models as last synced, by key. */
  async findModels(ctx: AppContext, connectionId: string): Promise<LlmModel[]> {
    // No config: it would be decrypted for nothing.
    const conn = await this.repository(ctx).findOne({
      select: { id: true, models: true },
      where: { id: connectionId },
    });
    return conn?.models ?? [];
  }

  /** Models of connectionId, which must be a connection of llmKey. */
  async listLLMModels(ctx: AppContext, llmKey: string, connectionId: string): Promise<LlmModel[]> {
    const conn = await this.repository(ctx).findOne({
      select: { id: true, models: true },
      where: { id: connectionId, llmKey },
    });
    if (!conn) throw new CoreError(CoreErrorCode.NOT_FOUND, `connection "${connectionId}" of "${llmKey}" not found`);
    return conn.models;
  }

  async generate(ctx: AppContext, dto: ExecuteLlm, signal?: AbortSignal): Promise<LlmResponse> {
    return this.runner.generate({ ...dto, targets: await this.resolveTargets(ctx, dto.targets), signal });
  }

  async *stream(ctx: AppContext, dto: ExecuteLlm, signal?: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    yield* this.runner.stream({ ...dto, targets: await this.resolveTargets(ctx, dto.targets), signal });
  }

  /**
   * Each target with its connection's llm and config. A target whose
   * connection is gone, or whose model isn't among the connection's synced
   * models, comes back with the error instead, so the runner skips it rather
   * than failing the whole run.
   */
  async resolveTargets(ctx: AppContext, targets: ExecuteLlmTarget[]): Promise<LLMTarget[]> {
    return Promise.all(
      targets.map(async ({ connectionId, model }): Promise<LLMTarget> => {
        const conn = await this.repository(ctx).findOne({
          select: { id: true, llmKey: true, config: true, models: true },
          where: { id: connectionId },
        });
        if (!conn) {
          const error = new LLMError(LLMErrorCode.CONNECTION_NOT_FOUND, `connection "${connectionId}" not found`);
          return { connectionId, model, error };
        }
        if (!conn.models.some((m) => m.key === model)) {
          return {
            connectionId,
            model,
            error: new LLMError(LLMErrorCode.MODEL_NOT_FOUND, `model "${model}" not found`),
          };
        }
        return { connectionId, llm: conn.llmKey, model, connection: conn.config };
      }),
    );
  }
}
