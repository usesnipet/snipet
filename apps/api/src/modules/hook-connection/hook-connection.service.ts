import { HookDrivers } from "#src/hook/driver.js";
import { HookDriverRegistry, HookRegistry } from "#src/hook/hook.registry.js";
import { ConnectionService } from "#src/manifest/connection.service.js";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService } from "@snipet/server-common";
import { Repository } from "typeorm";

import { AgentHook } from "../agent/agent.entity.js";
import { HookConnection } from "./hook-connection.entity.js";

import type { HookManifest } from "@snipet/shared";

@Injectable()
export class HookConnectionService extends ConnectionService<HookConnection, HookManifest, HookDrivers> {
  protected readonly keyField = "hookKey";

  constructor(
    @InjectRepository(HookConnection) repo: Repository<HookConnection>,
    hooks: HookRegistry,
    drivers: HookDriverRegistry,
  ) {
    super(repo, hooks, drivers);
  }

  /** The connection's handle driver with its options resolved; throws when the config no longer fits them. */
  handlerOf(conn: HookConnection) {
    return this.drivers.resolve(this.manifests.get(conn.hookKey), "handle", conn.config)!;
  }
}

@Injectable()
export class AgentHookService extends CrudService<AgentHook> {
  constructor(@InjectRepository(AgentHook) repo: Repository<AgentHook>) {
    super(repo);
  }
}
