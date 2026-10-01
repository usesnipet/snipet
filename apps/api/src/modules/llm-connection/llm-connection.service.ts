import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Not, QueryDeepPartialEntity, Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";

import { LlmConnection } from "./llm-connection.entity.js";
import { LlmError } from "../../infra/llm/errors.js";
import { LlmRegistry } from "../../infra/llm/registry.js";
import { LlmRunner, LlmTarget, splitModelRef } from "../../infra/llm/runner.js";

import type {
  ExecuteLlm,
  ExecuteLlmTarget,
  LlmConnectionOptions,
  LlmModel,
  LlmProviderInfo,
  LlmResponse,
  LlmStreamEvent,
} from "@snipet/shared";
// Writes run in a transaction so every provider with connections ends up
// with exactly one default: setting `default` clears it on the provider's
// other connections, and a provider left without one gets its oldest promoted.
@Injectable()
export class LlmConnectionService extends CrudService<LlmConnection> {
  constructor(
    @InjectRepository(LlmConnection) repo: Repository<LlmConnection>,
    private readonly registry: LlmRegistry,
    private readonly runner: LlmRunner,
  ) {
    super(repo);
  }

  // Connection options are validated (and health-checked) before saving.
  override async create(dto: DeepPartial<LlmConnection>): Promise<LlmConnection> {
    await this.registry.connect(dto.provider!, dto.config);
    return this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(LlmConnection);
      if (dto.default) await repo.update({ provider: dto.provider, default: true }, { default: false });
      const { id } = await repo.save(repo.create(dto));
      await promoteIfNoDefault(repo, dto.provider!);
      return repo.findOneByOrFail({ id });
    });
  }

  override async updateById(id: string, dto: QueryDeepPartialEntity<LlmConnection>): Promise<void> {
    const existing = await this.findById(id);
    const provider = (dto.provider as string | undefined) ?? existing.provider;
    if (dto.provider !== undefined || dto.config !== undefined) {
      await this.registry.connect(provider, (dto.config ?? existing.config) as LlmConnectionOptions);
    }

    await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(LlmConnection);
      if (dto.default) await repo.update({ provider, default: true, id: Not(id) }, { default: false });
      if (Object.keys(dto).length > 0) await repo.update(id, dto);
      await promoteIfNoDefault(repo, provider);
      if (provider !== existing.provider) await promoteIfNoDefault(repo, existing.provider);
    });
  }

  override async deleteById(id: string): Promise<void> {
    const existing = await this.findById(id);
    await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(LlmConnection);
      await repo.delete(id);
      await promoteIfNoDefault(repo, existing.provider);
    });
  }

  listProviders(): LlmProviderInfo[] {
    return this.registry.list();
  }

  // Sources options from connectionId, else the provider's default connection.
  async listProviderModels(providerKey: string, connectionId?: string): Promise<LlmModel[]> {
    const options = await this.connectionOptions(providerKey, connectionId);
    await this.registry.connect(providerKey, options);
    return this.registry.models(providerKey, options);
  }

  async generate(dto: ExecuteLlm, signal?: AbortSignal): Promise<LlmResponse> {
    return this.runner.generate({ ...dto, targets: await this.resolveTargets(dto.targets), signal });
  }

  async *stream(dto: ExecuteLlm, signal?: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    yield* this.runner.stream({ ...dto, targets: await this.resolveTargets(dto.targets), signal });
  }

  // Inline connectionOptions win; else connectionId; else the provider's default connection.
  private resolveTargets(targets: ExecuteLlmTarget[]): Promise<LlmTarget[]> {
    return Promise.all(
      targets.map(async (t) => ({
        model: t.model,
        extraOptions: t.extraOptions,
        connectionOptions:
          t.connectionOptions ?? (await this.connectionOptions(splitModelRef(t.model)[0], t.connectionId)),
      })),
    );
  }

  // A provider without a stored connection gets empty options; connect()
  // rejects them later if the provider needs any.
  private async connectionOptions(providerKey: string, connectionId?: string): Promise<LlmConnectionOptions> {
    if (connectionId) {
      const conn = await this.findById(connectionId);
      if (conn.provider !== providerKey) {
        throw new LlmError("invalid_options", `connection "${connectionId}" is not a "${providerKey}" connection`);
      }
      return conn.config;
    }
    const conn = await this.repo.findOneBy({ provider: providerKey, default: true });
    return conn?.config ?? {};
  }
}

async function promoteIfNoDefault(repo: Repository<LlmConnection>, provider: string) {
  if (await repo.existsBy({ provider, default: true })) return;
  const oldest = await repo.findOne({ where: { provider }, order: { createdAt: "ASC" } });
  if (oldest) await repo.update(oldest.id, { default: true });
}
