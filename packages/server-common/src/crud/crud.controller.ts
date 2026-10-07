import { paginationParamsSchema } from "@snipet/shared";
import { Body, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import z from "zod";

import { BaseEntity } from "./base.entity.js";
import { CrudService } from "./crud.service.js";
import { ZodPipe } from "../pipes/zod.pipe.js";

import type { DeepPartial } from "typeorm";
import type { FilterQuery } from "../pagination/filter.js";

interface CrudSchemas {
  create: z.ZodType;
  update: z.ZodType;
  filter?: z.ZodType;
  // Shapes each entity a route returns, e.g. to mask secrets.
  serialize?: (entity: never) => unknown;
}

// Returns a base class with the 5 CRUD routes. Usage:
//   @Controller("widget")
//   export class WidgetController extends CrudController<Widget>(schemas) {
//     constructor(service: WidgetService) { super(service); }
//   }
export function CrudController<T extends BaseEntity>(schemas: CrudSchemas) {
  const serialize = (schemas.serialize ?? ((entity: T) => entity)) as (entity: T) => unknown;

  abstract class Base {
    constructor(readonly service: CrudService<T>) {}

    @Get()
    async filter(@Query(new ZodPipe(schemas.filter ?? paginationParamsSchema)) query: FilterQuery<T>) {
      const page = await this.service.filter(query);
      return { ...page, data: page.data.map(serialize) };
    }

    @Get(":id")
    async findById(@Param("id", ParseUUIDPipe) id: string) {
      return serialize(await this.service.findById(id));
    }

    @Post()
    async create(@Body(new ZodPipe(schemas.create)) dto: object) {
      return serialize(await this.service.create(dto as DeepPartial<T>));
    }

    @Put(":id")
    @HttpCode(204)
    updateById(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(schemas.update)) dto: object) {
      return this.service.updateById(id, dto);
    }

    @Delete(":id")
    @HttpCode(204)
    deleteById(@Param("id", ParseUUIDPipe) id: string) {
      return this.service.deleteById(id);
    }
  }
  return Base;
}
