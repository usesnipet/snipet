import { AppContext } from "#src/common/context/app-context.js";
import { PluginConnection } from "#src/modules/plugin-connection/plugin-connection.entity.js";
import { Injectable } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { EntityManager, In } from "typeorm";

import type { PluginConnectionStore, RunPluginConnection } from "#src/core/store/plugin-connection.store.js";

/** The core's PluginConnectionStore on the plugin_connections table. */
@Injectable()
export class DatabasePluginConnectionStore extends BaseService<AppContext> implements PluginConnectionStore {
  constructor(protected readonly manager: EntityManager) {
    super(manager);
  }

  async findEnabled(ctx: AppContext, ids: string[]): Promise<Map<string, RunPluginConnection>> {
    if (!ids.length) return new Map();
    const connections = await this.repositoryOf(ctx, PluginConnection)
      .createQueryBuilder("connection")
      // tools is select: false on the entity.
      .addSelect("connection.tools")
      .where({ id: In(ids), enabled: true })
      .getMany();
    return new Map(
      connections.map((connection) => [
        connection.id,
        {
          id: connection.id,
          name: connection.name,
          pluginKey: connection.pluginKey,
          config: connection.config,
          tools: connection.tools,
          instructions: connection.customInstructions?.trim() || connection.instructions || null,
        },
      ]),
    );
  }
}
