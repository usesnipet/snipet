import { LLMDriverRegistry, LLMRegistry } from "#src/llm/llm.registry.js";
import { ConnectionSyncService } from "#src/manifest/connection-sync.service.js";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { LlmConnection } from "../llm-connection.entity.js";
import { LlmModel } from "../llm-model.entity.js";

import type { LLMDrivers } from "#src/llm/driver.js";
import type { LlmManifest } from "@snipet/shared";

/** Keeps llm_models in line with what each connection's models driver lists. */
@Injectable()
export class LlmConnectionSyncService extends ConnectionSyncService<LlmConnection, LlmManifest, LLMDrivers, LlmModel> {
  protected readonly keyField = "llmKey";
  protected readonly connectionField = "llmConnectionId";
  protected readonly itemKeyField = "key";

  constructor(
    @InjectRepository(LlmConnection) connections: Repository<LlmConnection>,
    registry: LLMRegistry,
    drivers: LLMDriverRegistry,
  ) {
    super(connections, registry, drivers, LlmModel);
  }

  protected async list(conn: LlmConnection, manifest: LlmManifest) {
    const { driver, options } = this.drivers.resolve(manifest, "models", conn.config)!;
    const models = await driver.listModels(options);
    return models.map((m) => ({ ...m, maxOutputTokens: m.maxOutputTokens ?? null }));
  }
}
