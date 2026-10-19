import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Not, QueryDeepPartialEntity, Repository } from "typeorm";

import { LlmError } from "#src/llm/errors.js";
import { LLMDriverRegistry, LLMRegistry } from "#src/llm/llm.registry.js";
import { LLMRunner, type LlmTarget } from "#src/llm/llm.runner.js";
import { splitModelRef } from "#src/llm/model-ref.js";
import { ConnectionService } from "#src/manifest/connection.service.js";

import { LlmConnection } from "./llm-connection.entity.js";
import { LlmModel } from "./llm-model.entity.js";
import { LlmConnectionSyncService } from "./sync/llm-connection-sync.service.js";

import type { LLMDrivers } from "#src/llm/driver.js";
import type { ExecuteLlm, ExecuteLlmTarget, LlmManifest, LlmResponse, LlmStreamEvent } from "@snipet/shared";

/**
 * Service for managing LLM connections and running conversations.
 */
@Injectable()
export class LlmConnectionService extends ConnectionService<LlmConnection, LlmManifest, LLMDrivers> {
  protected readonly keyField = "llmKey";

  constructor(
    @InjectRepository(LlmConnection) repo: Repository<LlmConnection>,
    @InjectRepository(LlmModel) private readonly models: Repository<LlmModel>,
    llms: LLMRegistry,
    drivers: LLMDriverRegistry,
    private readonly syncer: LlmConnectionSyncService,
    private readonly runner: LLMRunner,
  ) {
    super(repo, llms, drivers);
  }

  override async create(dto: DeepPartial<LlmConnection>): Promise<LlmConnection> {
    dto = this.checkCreate(dto);
    const { id } = await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(LlmConnection);
      if (dto.default) await repo.update({ llmKey: dto.llmKey, default: true }, { default: false });
      const saved = await repo.save(repo.create(dto));
      await promoteIfNoDefault(repo, dto.llmKey!);
      return saved;
    });
    void this.syncer.sync(id);
    return this.findById(id);
  }

  override async updateById(id: string, dto: QueryDeepPartialEntity<LlmConnection>): Promise<void> {
    const existing = await this.findById(id);
    const llmKey = (dto.llmKey as string | undefined) ?? existing.llmKey;
    dto = await this.checkUpdate(id, dto);

    await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(LlmConnection);
      if (dto.default) await repo.update({ llmKey, default: true, id: Not(id) }, { default: false });
      if (Object.keys(dto).length > 0) await repo.update(id, dto);
      await promoteIfNoDefault(repo, llmKey);
      if (llmKey !== existing.llmKey) await promoteIfNoDefault(repo, existing.llmKey);
    });
    if (dto.llmKey !== undefined || dto.config !== undefined) void this.syncer.sync(id);
  }

  override async deleteById(id: string): Promise<void> {
    const existing = await this.findById(id);
    await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(LlmConnection);
      await repo.delete(id);
      await promoteIfNoDefault(repo, existing.llmKey);
    });
  }

  sync(id: string): Promise<void> {
    return this.syncer.sync(id);
  }

  /** The connection's models as last synced. */
  findModels(connectionId: string): Promise<LlmModel[]> {
    return this.models.find({ where: { llmConnectionId: connectionId }, order: { key: "ASC" } });
  }

  /** Models of connectionId, else of the llm's default connection. */
  async listLLMModels(llmKey: string, connectionId?: string): Promise<LlmModel[]> {
    return this.findModels((await this.connectionFor(llmKey, connectionId)).id);
  }

  async generate(dto: ExecuteLlm, signal?: AbortSignal): Promise<LlmResponse> {
    return this.runner.generate({ ...dto, targets: await this.resolveTargets(dto.targets), signal });
  }

  async *stream(dto: ExecuteLlm, signal?: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    yield* this.runner.stream({ ...dto, targets: await this.resolveTargets(dto.targets), signal });
  }

  /**
   * Each target with its connection's config, once its model is known to be
   * among the connection's synced models.
   */
  async resolveTargets(targets: ExecuteLlmTarget[]): Promise<LlmTarget[]> {
    return Promise.all(
      targets.map(async (t) => {
        const [llmKey, model] = splitModelRef(t.model);
        const conn = await this.connectionFor(llmKey, t.connectionId);
        if (!(await this.models.existsBy({ llmConnectionId: conn.id, key: model }))) {
          throw new LlmError("model_not_found", `model "${t.model}" not found`);
        }
        return { model: t.model, connection: conn.config, extraOptions: t.extraOptions };
      }),
    );
  }

  private async connectionFor(llmKey: string, connectionId?: string): Promise<LlmConnection> {
    if (connectionId) {
      const conn = await this.findById(connectionId);
      if (conn.llmKey !== llmKey) {
        throw new LlmError("bad_request", `connection "${connectionId}" is not a "${llmKey}" connection`);
      }
      return conn;
    }
    const conn = await this.repo.findOneBy({ llmKey, default: true });
    if (!conn) throw new LlmError("bad_request", `no "${llmKey}" connection`);
    return conn;
  }
}

async function promoteIfNoDefault(repo: Repository<LlmConnection>, llmKey: string) {
  if (await repo.existsBy({ llmKey, default: true })) return;
  const oldest = await repo.findOne({ where: { llmKey }, order: { createdAt: "ASC" } });
  if (oldest) await repo.update(oldest.id, { default: true });
}
