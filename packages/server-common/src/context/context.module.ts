import {
  DynamicModule,
  Inject,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
} from "@nestjs/common";

import { BaseContext } from "./base-context.js";

import type { NextFunction, Request, Response } from "express";

declare module "express" {
  interface Request {
    ctx: BaseContext;
  }
}

export interface ContextOptions {
  // Builds the context of each request, e.g. `(req) => AppContext.create(randomUUID())`.
  create: (req: Request) => BaseContext;
}

const CONTEXT_OPTIONS = Symbol("CONTEXT_OPTIONS");

// Runs before guards, so every request (even @Public) has a context.
@Injectable()
class ContextMiddleware implements NestMiddleware {
  constructor(@Inject(CONTEXT_OPTIONS) private readonly options: ContextOptions) {}

  use(req: Request, _res: Response, next: NextFunction) {
    req.ctx = this.options.create(req);
    next();
  }
}

// Sets `req.ctx` on every request; read it with @Ctx().
@Module({})
export class ContextModule implements NestModule {
  static forRoot(options: ContextOptions): DynamicModule {
    return { module: ContextModule, providers: [{ provide: CONTEXT_OPTIONS, useValue: options }] };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes("{*splat}");
  }
}
