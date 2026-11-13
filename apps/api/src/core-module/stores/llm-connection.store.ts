import { AppContext } from "#src/common/context/app-context.js";
import { LlmConnection } from "#src/modules/llm-connection/llm-connection.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { EntityManager, In } from "typeorm";

import type { LLMConnectionStore, RunLLMConnection } from "#src/core/store/llm-connection.store.js";

/** The core's LLMConnectionStore on the llm_connections table. */
@Injectable()
export class DatabaseLLMConnectionStore extends BaseService<AppContext> implements LLMConnectionStore {
  constructor(protected readonly manager: EntityManager) {
    super(manager);
  }

  async findByIds(ctx: AppContext, ids: string[]): Promise<Map<string, RunLLMConnection>> {
    if (!ids.length) return new Map();
    const connections = await this.repositoryOf(ctx, LlmConnection)
      .createQueryBuilder("connection")
      // models is select: false on the entity.
      .addSelect("connection.models")
      .where({ id: In(ids) })
      .getMany();
    return new Map(
      connections.map((connection) => [
        connection.id,
        {
          id: connection.id,
          llmKey: connection.llmKey,
          config: connection.config,
          models: connection.models.map((model) => model.key),
        },
      ]),
    );
  }
}
