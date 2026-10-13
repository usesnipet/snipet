import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ZodPipe } from "@snipet/server-common";
import { Role } from "@snipet/shared";

import { Private, UserAuth } from "../../common/decorators/auth.decorator.js";

import {
  createPluginConnectionSchema,
  findPluginConnectionsSchema,
  updatePluginConnectionSchema,
} from "./plugin-connection.dto.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionService } from "./plugin-connection.service.js";

import type { FilterQuery } from "@snipet/server-common";
import type { CreatePluginConnection, UpdatePluginConnection } from "@snipet/shared";
import type { QueryDeepPartialEntity } from "typeorm";

@Private(UserAuth(Role.Admin))
@Controller("plugin-connections")
export class PluginConnectionController {
  constructor(private readonly service: PluginConnectionService) {}

  @Get("plugins")
  listPlugins() {
    return this.service.listManifests();
  }

  @Get("plugins/:key")
  getPlugin(@Param("key") key: string) {
    return this.service.getManifest(key);
  }

  @Get()
  async filter(@Query(new ZodPipe(findPluginConnectionsSchema)) query: FilterQuery<PluginConnection>) {
    const page = await this.service.filter(query);
    return { ...page, data: page.data.map((c) => this.service.mask(c)) };
  }

  @Get(":id")
  async findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.mask(await this.service.findById(id));
  }

  @Post()
  async create(@Body(new ZodPipe(createPluginConnectionSchema)) dto: CreatePluginConnection) {
    return this.service.mask(await this.service.create(dto));
  }

  @Put(":id")
  @HttpCode(204)
  updateById(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updatePluginConnectionSchema)) dto: UpdatePluginConnection,
  ) {
    return this.service.updateById(id, dto as QueryDeepPartialEntity<PluginConnection>);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteById(id);
  }

  @Post(":id/sync")
  @HttpCode(204)
  sync(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.sync(id);
  }
}
