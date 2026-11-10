import { AppContext } from "#src/common/context/app-context.js";
import { env } from "#src/env.js";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { CrudService } from "@snipet/server-common";
import { Role } from "@snipet/shared";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { DeepPartial, EntityManager, QueryDeepPartialEntity } from "typeorm";

import { User } from "./user.entity.js";

export const hashPassword = (password: string) => hash(password, 10);

@Injectable()
export class UserService extends CrudService<User> implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);

  constructor(manager: EntityManager) {
    super(manager, User);
  }

  /** Includes the password hash, which is never selected otherwise. */
  findByUsernameWithPassword(ctx: AppContext, username: string): Promise<User | null> {
    return this.repository(ctx)
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.username = :username", { username })
      .getOne();
  }

  findByIdWithPassword(ctx: AppContext, id: string): Promise<User | null> {
    return this.repository(ctx)
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.id = :id", { id })
      .getOne();
  }

  // Hashes the password and leaves the hash out of the returned user.
  override async create(ctx: AppContext, dto: DeepPartial<User>): Promise<User> {
    const { password, ...user } = await super.create(ctx, { ...dto, password: await hashPassword(dto.password!) });
    return user as User;
  }

  override async updateById(ctx: AppContext, id: string, dto: QueryDeepPartialEntity<User>): Promise<void> {
    if (typeof dto.password === "string") dto = { ...dto, password: await hashPassword(dto.password) };
    await super.updateById(ctx, id, dto);
  }

  setPassword(ctx: AppContext, id: string, password: string): Promise<void> {
    return this.updateById(ctx, id, { password });
  }

  /** Provisions the first admin on an empty users table. */
  async onApplicationBootstrap(): Promise<void> {
    // No request here: a root context, like Go's context.Background().
    const ctx = AppContext.create("bootstrap:root-user");
    if ((await this.repository(ctx).count()) > 0) return;

    const password = env.ROOT_PASSWORD || randomBytes(12).toString("base64url");
    await this.create(ctx, {
      username: env.ROOT_USERNAME,
      name: env.ROOT_USERNAME,
      password,
      role: Role.Admin,
    });
    this.logger.warn(
      env.ROOT_PASSWORD
        ? `created root user "${env.ROOT_USERNAME}"`
        : `created root user "${env.ROOT_USERNAME}" with password: ${password}`,
    );
  }
}
