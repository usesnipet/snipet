import { NotFoundException } from "@nestjs/common";
import { DeepPartial, FindOptionsWhere, QueryDeepPartialEntity, Repository } from "typeorm";

import { FilterQuery } from "../pagination/filter.js";

import { BaseEntity } from "./base.entity.js";

import type { Paginated } from "@snipet/shared";

// Generic CRUD over a TypeORM repository. Extend it and inject the repo:
//   constructor(@InjectRepository(Widget) repo: Repository<Widget>) { super(repo); }
export abstract class CrudService<T extends BaseEntity> {
  constructor(protected readonly repo: Repository<T>) {}

  async filter(query: FilterQuery<T>): Promise<Paginated<T>> {
    const [data, total] = await this.repo.findAndCount({
      where: query.where,
      order: query.order,
      take: query.take,
      skip: query.skip,
    });
    return { data, total, skip: query.skip, take: query.take };
  }

  async findById(id: string): Promise<T> {
    const entity = await this.repo.findOneBy({ id } as FindOptionsWhere<T>);
    if (!entity) throw new NotFoundException(`${this.name} not found`);
    return entity;
  }

  create(dto: DeepPartial<T>): Promise<T> {
    return this.repo.save(this.repo.create(dto));
  }

  // Partial update: only keys present in dto are written.
  async updateById(id: string, dto: QueryDeepPartialEntity<T>): Promise<void> {
    if (Object.keys(dto).length === 0) {
      await this.findById(id);
      return;
    }

    const result = await this.repo.update(id, dto);
    if (!result.affected) throw new NotFoundException(`${this.name} not found`);
  }

  async deleteById(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException(`${this.name} not found`);
  }

  private get name() {
    return this.repo.metadata.name;
  }
}
