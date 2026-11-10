import { Body, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { paginationParamsSchema } from "@snipet/shared";
import z from "zod";

import { BaseContext } from "../context/base-context.js";
import { Ctx } from "../context/ctx.decorator.js";
import { ZodPipe } from "../pipes/zod.pipe.js";

import { BaseEntity } from "./base.entity.js";
import { CrudService } from "./crud.service.js";

import type { DeepPartial } from "typeorm";
import type { FilterQuery } from "../pagination/filter.js";
interface CrudSchemas {
  create: z.ZodType;
  update: z.ZodType;
  filter?: z.ZodType;
  /** Shapes each entity a route returns, e.g. to mask secrets; may be async. */
  serialize?: (entity: never) => unknown;
}

/**
 * Returns a base class with the 5 CRUD routes.
 * @example
 * @Controller("widget")
 * export class WidgetController extends CrudController<Widget>(schemas) {
 *   constructor(service: WidgetService) { super(service); }
 * }
 */
export function CrudController<T extends BaseEntity, C extends BaseContext = BaseContext>(schemas: CrudSchemas) {
  const serialize = (schemas.serialize ?? ((entity: T) => entity)) as (entity: T) => unknown;

  abstract class Base {
    constructor(readonly service: CrudService<T, C>) {}

    /** Shapes each entity a route returns; override to use the service. */
    serialize(_ctx: C, entity: T): unknown {
      return serialize(entity);
    }

    @Get()
    async filter(@Ctx() ctx: C, @Query(new ZodPipe(schemas.filter ?? paginationParamsSchema)) query: FilterQuery<T>) {
      const page = await this.service.filter(ctx, query);
      return { ...page, data: await Promise.all(page.data.map((e) => this.serialize(ctx, e))) };
    }

    @Get(":id")
    async findById(@Ctx() ctx: C, @Param("id", ParseUUIDPipe) id: string) {
      return this.serialize(ctx, await this.service.findById(ctx, id));
    }

    @Post()
    async create(@Ctx() ctx: C, @Body(new ZodPipe(schemas.create)) dto: object) {
      return this.serialize(ctx, await this.service.create(ctx, dto as DeepPartial<T>));
    }

    @Put(":id")
    @HttpCode(204)
    updateById(@Ctx() ctx: C, @Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(schemas.update)) dto: object) {
      return this.service.updateById(ctx, id, dto);
    }

    @Delete(":id")
    @HttpCode(204)
    deleteById(@Ctx() ctx: C, @Param("id", ParseUUIDPipe) id: string) {
      return this.service.deleteById(ctx, id);
    }
  }
  return Base;
}
