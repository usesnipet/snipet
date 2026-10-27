import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { CrudController, ZodPipe } from "@snipet/server-common";
import { Role } from "@snipet/shared";

import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";

import { AgentHook } from "../agent/agent.entity.js";
import {
  createAgentHookSchema,
  createHookConnectionSchema,
  findAgentHooksSchema,
  findHookConnectionsSchema,
  updateAgentHookSchema,
  updateHookConnectionSchema,
} from "./hook-connection.dto.js";
import { HookConnection } from "./hook-connection.entity.js";
import { AgentHookService, HookConnectionService } from "./hook-connection.service.js";

import type { FilterQuery } from "@snipet/server-common";
import type { CreateHookConnection, UpdateHookConnection } from "@snipet/shared";
import type { QueryDeepPartialEntity } from "typeorm";

@Private(UserAuth(Role.Admin))
@Controller("hook-connections")
export class HookConnectionController {
  constructor(private readonly service: HookConnectionService) {}

  @Get("hooks")
  listHooks() {
    return this.service.listManifests();
  }

  @Get("hooks/:key")
  getHook(@Param("key") key: string) {
    return this.service.getManifest(key);
  }

  @Get()
  async filter(@Query(new ZodPipe(findHookConnectionsSchema)) query: FilterQuery<HookConnection>) {
    const page = await this.service.filter(query);
    return { ...page, data: page.data.map((c) => this.service.mask(c)) };
  }

  @Get(":id")
  async findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.mask(await this.service.findById(id));
  }

  @Post()
  async create(@Body(new ZodPipe(createHookConnectionSchema)) dto: CreateHookConnection) {
    return this.service.mask(await this.service.create(dto));
  }

  @Put(":id")
  @HttpCode(204)
  updateById(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateHookConnectionSchema)) dto: UpdateHookConnection,
  ) {
    return this.service.updateById(id, dto as QueryDeepPartialEntity<HookConnection>);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteById(id);
  }
}

/** Admin only, like agents: global hooks see every run. */
@Private(UserAuth(Role.Admin))
@Controller("agent-hooks")
export class AgentHookController extends CrudController<AgentHook>({
  create: createAgentHookSchema,
  update: updateAgentHookSchema,
  filter: findAgentHooksSchema,
}) {
  constructor(override readonly service: AgentHookService) {
    super(service);
  }
}
