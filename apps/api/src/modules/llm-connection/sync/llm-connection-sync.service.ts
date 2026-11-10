import { LLMDriverRegistry, LLMRegistry } from "#src/llm/llm.registry.js";
import { ConnectionSyncService } from "#src/manifest/connection-sync.service.js";
import { uniqueSortedBy } from "#src/utils/sort/index.js";
import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";

import { LlmConnection } from "../llm-connection.entity.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { LLMDrivers } from "#src/llm/driver.js";
import type { LlmManifest } from "@snipet/shared";

/** Keeps each connection's models in line with its models driver. */
@Injectable()
export class LlmConnectionSyncService extends ConnectionSyncService<LlmConnection, LlmManifest, LLMDrivers> {
  override readonly keyField = "llmKey";

  constructor(manager: EntityManager, registry: LLMRegistry, drivers: LLMDriverRegistry) {
    super(manager, LlmConnection, registry, drivers);
  }

  protected async fields(
    _ctx: AppContext,
    conn: LlmConnection,
    manifest: LlmManifest,
  ): Promise<Partial<LlmConnection>> {
    const { driver, options } = this.drivers.resolve(manifest, "models", conn.config)!;
    return { models: uniqueSortedBy(await driver.listModels(options), (m) => m.key) };
  }
}
