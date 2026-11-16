import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";
import { authorizePluginConnectionSchema, Role } from "@snipet/shared";

import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";

import {
  createPluginConnectionSchema,
  findPluginConnectionsSchema,
  updatePluginConnectionSchema,
} from "./plugin-connection.dto.js";
import { PluginConnection } from "./plugin-connection.entity.js";
import { PluginConnectionOAuthService } from "./plugin-connection.oauth.service.js";
import { PluginConnectionService } from "./plugin-connection.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { FilterQuery } from "@snipet/server-common";
import type { AuthorizePluginConnection, CreatePluginConnection, UpdatePluginConnection } from "@snipet/shared";
import type { QueryDeepPartialEntity } from "typeorm";

@Private(UserAuth(Role.Admin))
@Controller("plugin-connections")
export class PluginConnectionController {
  constructor(
    private readonly pluginConnectionService: PluginConnectionService,
    private readonly pluginConnectionOAuthService: PluginConnectionOAuthService,
  ) {}

  @Get("plugins")
  listPlugins(@Ctx() ctx: AppContext) {
    return this.pluginConnectionService.listManifests(ctx);
  }

  @Get("plugins/:key")
  getPlugin(@Ctx() ctx: AppContext, @Param("key") key: string) {
    return this.pluginConnectionService.getManifest(ctx, key);
  }

  @Get()
  async filter(
    @Ctx() ctx: AppContext,
    @Query(new ZodPipe(findPluginConnectionsSchema)) query: FilterQuery<PluginConnection>,
  ) {
    const page = await this.pluginConnectionService.filter(ctx, query);
    return { ...page, data: page.data.map((c) => this.pluginConnectionService.mask(ctx, c)) };
  }

  @Get(":id")
  async findById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.pluginConnectionService.mask(ctx, await this.pluginConnectionService.findById(ctx, id));
  }

  @Get(":id/tools")
  listTools(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.pluginConnectionService.listTools(ctx, id);
  }

  @Post()
  async create(@Ctx() ctx: AppContext, @Body(new ZodPipe(createPluginConnectionSchema)) dto: CreatePluginConnection) {
    return this.pluginConnectionService.mask(ctx, await this.pluginConnectionService.create(ctx, dto));
  }

  @Put(":id")
  @HttpCode(204)
  updateById(
    @Ctx() ctx: AppContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updatePluginConnectionSchema)) dto: UpdatePluginConnection,
  ) {
    return this.pluginConnectionService.updateById(ctx, id, dto as QueryDeepPartialEntity<PluginConnection>);
  }

  @Delete(":id")
  @HttpCode(204)
  async deleteById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    await this.pluginConnectionOAuthService.disconnect(ctx, id);
    await this.pluginConnectionService.deleteById(ctx, id);
  }

  @Post(":id/sync")
  @HttpCode(204)
  sync(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.pluginConnectionService.sync(ctx, id);
  }

  /** The provider's consent page; the web app sends the user there. */
  @Post(":id/oauth/authorize")
  authorize(
    @Ctx() ctx: AppContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(authorizePluginConnectionSchema)) dto: AuthorizePluginConnection,
  ) {
    return this.pluginConnectionOAuthService.authorize(ctx, id, dto.returnTo);
  }

  @Delete(":id/oauth")
  @HttpCode(204)
  disconnect(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.pluginConnectionOAuthService.disconnect(ctx, id);
  }
}
