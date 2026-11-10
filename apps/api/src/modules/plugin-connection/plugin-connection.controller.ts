import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";
import { Role } from "@snipet/shared";

import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";

import {
  createPluginConnectionSchema,
  findPluginConnectionsSchema,
  updatePluginConnectionSchema,
} from "./plugin-connection.dto.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionService } from "./plugin-connection.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { FilterQuery } from "@snipet/server-common";
import type { CreatePluginConnection, UpdatePluginConnection } from "@snipet/shared";
import type { QueryDeepPartialEntity } from "typeorm";

@Private(UserAuth(Role.Admin))
@Controller("plugin-connections")
export class PluginConnectionController {
  constructor(private readonly service: PluginConnectionService) {}

  @Get("plugins")
  listPlugins(@Ctx() ctx: AppContext) {
    return this.service.listManifests(ctx);
  }

  @Get("plugins/:key")
  getPlugin(@Ctx() ctx: AppContext, @Param("key") key: string) {
    return this.service.getManifest(ctx, key);
  }

  @Get()
  async filter(
    @Ctx() ctx: AppContext,
    @Query(new ZodPipe(findPluginConnectionsSchema)) query: FilterQuery<PluginConnection>,
  ) {
    const page = await this.service.filter(ctx, query);
    return { ...page, data: page.data.map((c) => this.service.mask(ctx, c)) };
  }

  @Get(":id")
  async findById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.mask(ctx, await this.service.findById(ctx, id));
  }

  @Get(":id/tools")
  listTools(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.listTools(ctx, id);
  }

  @Post()
  async create(@Ctx() ctx: AppContext, @Body(new ZodPipe(createPluginConnectionSchema)) dto: CreatePluginConnection) {
    return this.service.mask(ctx, await this.service.create(ctx, dto));
  }

  @Put(":id")
  @HttpCode(204)
  updateById(
    @Ctx() ctx: AppContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updatePluginConnectionSchema)) dto: UpdatePluginConnection,
  ) {
    return this.service.updateById(ctx, id, dto as QueryDeepPartialEntity<PluginConnection>);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteById(ctx, id);
  }

  @Post(":id/sync")
  @HttpCode(204)
  sync(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.sync(ctx, id);
  }
}
