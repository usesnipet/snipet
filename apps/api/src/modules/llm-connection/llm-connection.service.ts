import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Not, QueryDeepPartialEntity, Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";

import { LlmConnection } from "./llm-connection.entity.js";

// Writes run in a transaction so every provider with connections ends up
// with exactly one default: setting `default` clears it on the provider's
// other connections, and a provider left without one gets its oldest promoted.
@Injectable()
export class LlmConnectionService extends CrudService<LlmConnection> {
  constructor(@InjectRepository(LlmConnection) repo: Repository<LlmConnection>) {
    super(repo);
  }

  override create(dto: DeepPartial<LlmConnection>): Promise<LlmConnection> {
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
}

async function promoteIfNoDefault(repo: Repository<LlmConnection>, provider: string) {
  if (await repo.existsBy({ provider, default: true })) return;
  const oldest = await repo.findOne({ where: { provider }, order: { createdAt: "ASC" } });
  if (oldest) await repo.update(oldest.id, { default: true });
}
