import { Injectable } from "@nestjs/common";
import { DeepPartial, EntityManager, Not, QueryDeepPartialEntity, Repository } from "typeorm";

import { LlmError } from "#src/llm/errors.js";
import { LLMDriverRegistry, LLMRegistry } from "#src/llm/llm.registry.js";
import { LLMRunner, type LlmTarget } from "#src/llm/llm.runner.js";
import { splitModelRef } from "#src/llm/model-ref.js";
import { ConnectionService } from "#src/manifest/connection.service.js";

import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionSyncService } from "./sync/llm-connection-sync.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { LLMDrivers } from "#src/llm/driver.js";
import type { ExecuteLlm, ExecuteLlmTarget, LlmManifest, LlmModel, LlmResponse, LlmStreamEvent } from "@snipet/shared";

/**
 * Service for managing LLM connections and running conversations.
 */
@Injectable()
export class LlmConnectionService extends ConnectionService<LlmConnection, LlmManifest, LLMDrivers> {
  protected readonly keyField = "llmKey";

  constructor(
    manager: EntityManager,
    llms: LLMRegistry,
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

  /** Models of connectionId, else of the llm's default connection. */
  async listLLMModels(ctx: AppContext, llmKey: string, connectionId?: string): Promise<LlmModel[]> {
    return this.findModels(ctx, (await this.connectionFor(ctx, llmKey, connectionId)).id);
  }

  async generate(ctx: AppContext, dto: ExecuteLlm, signal?: AbortSignal): Promise<LlmResponse> {
    return this.runner.generate({ ...dto, targets: await this.resolveTargets(ctx, dto.targets), signal });
  }

  async *stream(ctx: AppContext, dto: ExecuteLlm, signal?: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    yield* this.runner.stream({ ...dto, targets: await this.resolveTargets(ctx, dto.targets), signal });
  }

  /**
   * Each target with its connection's config, once its model is known to be
   * among the connection's synced models.
   */
  async resolveTargets(ctx: AppContext, targets: ExecuteLlmTarget[]): Promise<LlmTarget[]> {
    return Promise.all(
      targets.map(async (t) => {
        const [llmKey, model] = splitModelRef(t.model);
        const conn = await this.connectionFor(ctx, llmKey, t.connectionId);
        if (!(await this.findModels(ctx, conn.id)).some((m) => m.key === model)) {
          throw new LlmError("model_not_found", `model "${t.model}" not found`);
        }
        return { model: t.model, connection: conn.config, extraOptions: t.extraOptions };
      }),
    );
  }

  private async connectionFor(ctx: AppContext, llmKey: string, connectionId?: string): Promise<LlmConnection> {
    if (connectionId) {
      const conn = await this.findById(ctx, connectionId);
      if (conn.llmKey !== llmKey) {
        throw new LlmError("bad_request", `connection "${connectionId}" is not a "${llmKey}" connection`);
      }
      return conn;
    }
    const conn = await this.repository(ctx).findOneBy({ llmKey, default: true });
    if (!conn) throw new LlmError("bad_request", `no "${llmKey}" connection`);
    return conn;
  }
}

async function promoteIfNoDefault(repo: Repository<LlmConnection>, llmKey: string) {
  if (await repo.existsBy({ llmKey, default: true })) return;
  const oldest = await repo.findOne({ where: { llmKey }, order: { createdAt: "ASC" } });
  if (oldest) await repo.update(oldest.id, { default: true });
}
