import { AppContext } from "#src/common/context/app-context.js";
import { PluginConnection } from "#src/modules/plugin-connection/plugin-connection.entity.js";
import { PluginConnectionTokenService } from "#src/modules/plugin-connection/plugin-connection.token.service.js";
import { Injectable, Logger } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { EntityManager, In } from "typeorm";

import type { PluginConnectionStore, RunPluginConnection } from "#src/core/store/plugin-connection.store.js";

/** The core's PluginConnectionStore on the plugin_connections table. */
@Injectable()
export class DatabasePluginConnectionStore extends BaseService<AppContext> implements PluginConnectionStore {
  private readonly logger = new Logger(DatabasePluginConnectionStore.name);

  constructor(
    protected readonly manager: EntityManager,
    private readonly pluginConnectionTokenService: PluginConnectionTokenService,
  ) {
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
    const entries = await Promise.all(
      connections.map(async (connection): Promise<[string, RunPluginConnection] | undefined> => {
        let auth;
        try {
          auth = await this.pluginConnectionTokenService.authOf(ctx, connection);
        } catch (err) {
          // Left out like a disabled one: the run goes on without its tools.
          this.logger.warn(`plugin connection ${connection.id}: ${(err as Error).message}`);
          return undefined;
        }
        return [
          connection.id,
          {
            id: connection.id,
            name: connection.name,
            pluginKey: connection.pluginKey,
            config: connection.config,
            auth,
            tools: connection.tools,
            instructions: connection.customInstructions?.trim() || connection.instructions || null,
          },
        ];
      }),
    );
    return new Map(entries.filter((entry) => entry !== undefined));
  }
}
