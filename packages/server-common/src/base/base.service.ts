import { Logger } from "@nestjs/common";
import { EntityManager, EntityTarget, ObjectLiteral, Repository } from "typeorm";

import { BaseContext } from "../context/base-context.js";

/**
 * Generic service. Extend it and inject the manager:
 * @example constructor(manager: EntityManager) { super(manager); }
 * Every method takes the request context first.
 */
export abstract class BaseService<C extends BaseContext = BaseContext> {
  constructor(protected readonly manager: EntityManager) {}

  /** Another entity's table, on the same transaction as `repository(ctx)`. */
  protected repositoryOf<E extends ObjectLiteral>(ctx: C | undefined, target: EntityTarget<E>): Repository<E> {
    if (!this.manager) {
      const logger = new Logger(this.constructor.name);
      logger.error("EntityManager not found, do you remember to inject it?");
    }
    return (ctx?.tx ?? this.manager).getRepository(target);
  }

  // Runs fn in a transaction, reusing the context's one if it's already in one.
  protected transaction<R>(ctx: C, fn: (ctx: C) => Promise<R>): Promise<R> {
    return ctx.tx ? fn(ctx) : this.manager.transaction((tx) => fn(ctx.withTx(tx)));
  }
}
