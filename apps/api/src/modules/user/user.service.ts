import { randomBytes } from "node:crypto";

import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Role } from "@snipet/shared";
import { hash } from "bcryptjs";
import { Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";
import { env } from "../../env.js";
import { User } from "./user.entity.js";

export const hashPassword = (password: string) => hash(password, 10);

@Injectable()
export class UserService extends CrudService<User> implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectRepository(User) repo: Repository<User>) {
    super(repo);
  }

  // Includes the password hash, which is never selected otherwise.
  findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.username = :username", { username })
      .getOne();
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo.createQueryBuilder("user").addSelect("user.password").where("user.id = :id", { id }).getOne();
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.updateById(id, { password: await hashPassword(password) });
  }

  // Provisions the first admin on an empty users table.
  async onApplicationBootstrap(): Promise<void> {
    if ((await this.repo.count()) > 0) return;

    const password = env.ROOT_PASSWORD || randomBytes(12).toString("base64url");
    await this.create({
      username: env.ROOT_USERNAME,
      name: env.ROOT_USERNAME,
      password: await hashPassword(password),
      role: Role.Admin,
    });
    this.logger.warn(
      env.ROOT_PASSWORD
        ? `created root user "${env.ROOT_USERNAME}"`
        : `created root user "${env.ROOT_USERNAME}" with password: ${password}`,
    );
  }
}
