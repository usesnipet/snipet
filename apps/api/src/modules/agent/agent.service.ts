import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService } from "@snipet/server-common";
import { QueryDeepPartialEntity, Repository } from "typeorm";

import { Agent, AgentLlm, AgentPluginConnection } from "./agent.entity.js";

import type { CreateAgent, UpdateAgent } from "@snipet/shared";

@Injectable()
export class AgentService extends CrudService<Agent> {
  constructor(@InjectRepository(Agent) repo: Repository<Agent>) {
    super(repo);
  }

  override async create(dto: CreateAgent): Promise<Agent> {
    // The position in llms is the order the runner tries them.
    const llms = dto.llms.map((llm, order) => ({ ...llm, order }));
    const { id } = await this.repo.save(this.repo.create({ ...dto, llms }));
    return this.findById(id);
  }

  // llms and pluginConnections, when sent, replace the agent's whole list.
  override async updateById(id: string, dto: QueryDeepPartialEntity<Agent>): Promise<void> {
    const { llms, pluginConnections, ...fields } = dto as UpdateAgent;
    await this.repo.manager.transaction(async (m) => {
      const agentRepo = m.getRepository(Agent);
      const llmRepo = m.getRepository(AgentLlm);
      const pluginConnectionRepo = m.getRepository(AgentPluginConnection);
      if (!(await agentRepo.existsBy({ id }))) throw new NotFoundException("Agent not found");
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
  }
}
