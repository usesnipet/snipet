import { storageKeyOf } from "#src/infra/storage/utils.js";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService } from "@snipet/server-common";
import { QueryDeepPartialEntity, Repository } from "typeorm";

import { FilesStorage } from "../files/files.storage.js";

import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";

import type { CreateAgent, UpdateAgent } from "@snipet/shared";

@Injectable()
export class AgentService extends CrudService<Agent> {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(Agent) repo: Repository<Agent>,
    private readonly files: FilesStorage,
  ) {
    super(repo);
  }

  override async create(dto: CreateAgent): Promise<Agent> {
    const avatar = await this.storeAvatar(dto.avatar);
    // The position in llms is the order the runner tries them.
    const llms = dto.llms.map((llm, order) => ({ ...llm, order }));
    try {
      const { id } = await this.repo.save(this.repo.create({ ...dto, avatar, llms }));
      return this.findById(id);
    } catch (error) {
      if (avatar) await this.removeFile(avatar);
      throw error;
    }
  }

  // llms and pluginConnections, when sent, replace the agent's whole list.
  override async updateById(id: string, dto: QueryDeepPartialEntity<Agent>): Promise<void> {
    const { llms, pluginConnections, avatar: avatarInput, ...rest } = dto as UpdateAgent;
    const avatar = await this.storeAvatar(avatarInput);
    const fields = avatar === undefined ? rest : { ...rest, avatar };
    let previousAvatar: string | null = null;
    try {
      await this.repo.manager.transaction(async (m) => {
        const agentRepo = m.getRepository(Agent);
        const llmRepo = m.getRepository(AgentLlm);
        const pluginConnectionRepo = m.getRepository(AgentPluginConnection);
        const current = await agentRepo.findOne({
          where: { id },
          select: { id: true, avatar: true },
          loadEagerRelations: false,
        });
        if (!current) throw new NotFoundException("Agent not found");
        previousAvatar = current.avatar;
        if (Object.keys(fields).length) await agentRepo.update(id, fields);
        if (llms) {
          await llmRepo.delete({ agentId: id });
          await llmRepo.save(llms.map((llm, order) => ({ ...llm, order, agentId: id })));
        }
        if (pluginConnections) {
          await pluginConnectionRepo.delete({ agentId: id });
          await pluginConnectionRepo.insert(pluginConnections.map((grant) => ({ ...grant, agentId: id })));
        }
      });
    } catch (error) {
      if (avatar) await this.removeFile(avatar);
      throw error;
    }
    if (avatar !== undefined && previousAvatar) await this.removeFile(previousAvatar);
  }

  override async deleteById(id: string): Promise<void> {
    const agent = await this.repo.findOne({
      where: { id },
      select: { id: true, avatar: true },
      loadEagerRelations: false,
    });
    await super.deleteById(id);
    if (agent?.avatar) await this.removeFile(agent.avatar);
  }

  // A data URL is uploaded and becomes its stored path, null clears the
  // avatar, and anything else (the current avatar's URL) leaves it as is.
  private async storeAvatar(avatar: string | null | undefined): Promise<string | null | undefined> {
    if (avatar?.startsWith("data:")) return this.files.putDataUrl("agents", avatar);
    return avatar === null ? null : undefined;
  }

  // An orphaned file is harmless; a failed cleanup must not fail the request.
  private async removeFile(pathOrUrl: string) {
    await this.files.delete(storageKeyOf(pathOrUrl)).catch((error: unknown) => {
      this.logger.warn(`Could not delete ${pathOrUrl}: ${String(error)}`);
    });
  }
}
