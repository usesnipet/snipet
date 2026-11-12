import { NotFoundException } from "@nestjs/common";
import {
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  QueryDeepPartialEntity,
  Repository,
} from "typeorm";

import { BaseEntity } from "../base/base.entity.js";
import { BaseService } from "../base/base.service.js";
import { BaseContext } from "../context/base-context.js";
import { FilterQuery } from "../pagination/filter.js";

import type { Paginated } from "@snipet/shared";
/**
 * Generic CRUD over a TypeORM entity. Extend it and inject the manager:
 * @example constructor(manager: EntityManager) { super(manager, Widget); }
 * Every method takes the request context first.
 */
export abstract class CrudService<T extends BaseEntity, C extends BaseContext = BaseContext> extends BaseService<C> {
  constructor(
    protected readonly manager: EntityManager,
    private readonly target: EntityTarget<T>,
  ) {
    super(manager);
  }

  /** The entity's table, joining the context's transaction when there is one. */
  protected repository(ctx?: C): Repository<T> {
    return this.repositoryOf(ctx, this.target);
  }

  async filter(ctx: C, query: FilterQuery<T>): Promise<Paginated<T>> {
    const [data, total] = await this.repository(ctx).findAndCount({
      where: query.where,
      order: query.order,
      take: query.take,
      skip: query.skip,
      relations: query.relations,
    });
    return { data, total, skip: query.skip, take: query.take };
  }

  async findById(ctx: C, id: string): Promise<T> {
    const entity = await this.repository(ctx).findOneBy({ id } as FindOptionsWhere<T>);
    if (!entity) throw new NotFoundException(`${this.name} not found`);
    return entity;
  }

  create(ctx: C, dto: DeepPartial<T>): Promise<T> {
    const repo = this.repository(ctx);
    return repo.save(repo.create(dto));
  }

  // Partial update: only keys present in dto are written.
  async updateById(ctx: C, id: string, dto: QueryDeepPartialEntity<T>): Promise<void> {
    if (Object.keys(dto).length === 0) {
      await this.findById(ctx, id);
      return;
    }

    const result = await this.repository(ctx).update(id, dto);
    if (!result.affected) throw new NotFoundException(`${this.name} not found`);
  }

  async deleteById(ctx: C, id: string): Promise<void> {
    const result = await this.repository(ctx).delete(id);
    if (!result.affected) throw new NotFoundException(`${this.name} not found`);
  }

  private get name() {
    return this.manager.dataSource.getMetadata(this.target).name;
  }
}
