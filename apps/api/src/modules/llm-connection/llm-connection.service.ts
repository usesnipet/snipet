import { CoreError, CoreErrorCode } from "#src/core/error.js";
import { LLMError, LLMErrorCode } from "#src/core/llm/errors.js";
import { LLMRunner, LLMTarget } from "#src/core/llm/llm.runner.js";
import { LLMDriverRegistry, LLMManifestRegistry } from "#src/core/llm/llm.registry.js";
import { ConnectionService } from "#src/common/connection-sync/connection.service.js";
import { Injectable } from "@nestjs/common";
import { DeepPartial, EntityManager, Not, QueryDeepPartialEntity, Repository } from "typeorm";

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
    dto = this.checkCreate(ctx, dto);
    const { id } = await this.transaction(ctx, async (ctx) => {
      const repo = this.repository(ctx);
      if (dto.default) await repo.update({ llmKey: dto.llmKey, default: true }, { default: false });
      const saved = await repo.save(repo.create(dto));
      await promoteIfNoDefault(repo, dto.llmKey!);
      return saved;
    });
    void this.syncer.sync(ctx, id);
    return this.findById(ctx, id);
  }

  override async updateById(ctx: AppContext, id: string, dto: QueryDeepPartialEntity<LlmConnection>): Promise<void> {
    const existing = await this.findById(ctx, id);
    const llmKey = (dto.llmKey as string | undefined) ?? existing.llmKey;
    dto = await this.checkUpdate(ctx, id, dto);

    await this.transaction(ctx, async (ctx) => {
      const repo = this.repository(ctx);
      if (dto.default) await repo.update({ llmKey, default: true, id: Not(id) }, { default: false });
      if (Object.keys(dto).length > 0) await repo.update(id, dto);
      await promoteIfNoDefault(repo, llmKey);
      if (llmKey !== existing.llmKey) await promoteIfNoDefault(repo, existing.llmKey);
    });
    if (dto.llmKey !== undefined || dto.config !== undefined) void this.syncer.sync(ctx, id);
  }

  override async deleteById(ctx: AppContext, id: string): Promise<void> {
    const existing = await this.findById(ctx, id);
    await this.transaction(ctx, async (ctx) => {
      const repo = this.repository(ctx);
      await repo.delete(id);
      await promoteIfNoDefault(repo, existing.llmKey);
    });
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
   * Each target with its connection's config. A target whose connection is
   * gone (or belongs to another llm), or whose model isn't among the
   * connection's synced models, comes back with the error instead, so the
   * runner skips it rather than failing the whole run.
   */
  async resolveTargets(ctx: AppContext, targets: ExecuteLlmTarget[]): Promise<LLMTarget[]> {
    return Promise.all(
      targets.map(async ({ llm, model, connectionId }): Promise<LLMTarget> => {
        const conn = await this.repository(ctx).findOne({
          select: { id: true, config: true, models: true },
          where: { id: connectionId, llmKey: llm },
        });
        if (!conn) {
          const error = new LLMError(
            LLMErrorCode.CONNECTION_NOT_FOUND,
            `connection "${connectionId}" of "${llm}" not found`,
          );
          return { llm, model, error };
        }
        if (!conn.models.some((m) => m.key === model)) {
          return { llm, model, error: new LLMError(LLMErrorCode.MODEL_NOT_FOUND, `model "${llm}/${model}" not found`) };
        }
        return { llm, model, connection: conn.config };
      }),
    );
  }
}

async function promoteIfNoDefault(repo: Repository<LlmConnection>, llmKey: string) {
  if (await repo.existsBy({ llmKey, default: true })) return;
  const oldest = await repo.findOne({ where: { llmKey }, order: { createdAt: "ASC" } });
  if (oldest) await repo.update(oldest.id, { default: true });
}
