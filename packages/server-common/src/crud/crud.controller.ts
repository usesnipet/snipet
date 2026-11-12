import { Body, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants.js";
import { paginationParamsSchema } from "@snipet/shared";
import z from "zod";

import { BaseEntity } from "../base/base.entity.js";
import { BaseContext } from "../context/base-context.js";
import { Ctx } from "../context/ctx.decorator.js";
import { ZodPipe } from "../pipes/zod.pipe.js";

import { CrudService } from "./crud.service.js";

import type { DeepPartial } from "typeorm";
import type { FilterQuery } from "../pagination/filter.js";
/** A route of CrudController, by its method name. */
export type CrudRoute = "filter" | "findById" | "create" | "updateById" | "deleteById";

interface CrudSchemas {
  /** Required unless `create` is in `except`. */
  create?: z.ZodType;
  /** Required unless `updateById` is in `except`. */
  update?: z.ZodType;
  filter?: z.ZodType;
  /** Shapes each entity a route returns, e.g. to mask secrets; may be async. */
  serialize?: (entity: never) => unknown;
  /** Routes left out; a subclass may still declare its own on the same method. */
  except?: readonly CrudRoute[];
}

/**
 * Returns a base class with the 5 CRUD routes, minus those in `schemas.except`.
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
    async create(@Ctx() ctx: C, @Body(new ZodPipe(schemas.create ?? z.never())) dto: object) {
      return this.serialize(ctx, await this.service.create(ctx, dto as DeepPartial<T>));
    }

    @Put(":id")
    @HttpCode(204)
    updateById(
      @Ctx() ctx: C,
      @Param("id", ParseUUIDPipe) id: string,
      @Body(new ZodPipe(schemas.update ?? z.never())) dto: object,
    ) {
      return this.service.updateById(ctx, id, dto);
    }

    @Delete(":id")
    @HttpCode(204)
    deleteById(@Ctx() ctx: C, @Param("id", ParseUUIDPipe) id: string) {
      return this.service.deleteById(ctx, id);
    }
  }

  // Nest routes a method only if it has a path: without one it stays a plain method.
  for (const route of schemas.except ?? []) {
    Reflect.deleteMetadata(PATH_METADATA, Object.getOwnPropertyDescriptor(Base.prototype, route)!.value as object);
  }
  return Base;
}
