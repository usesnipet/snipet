import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { Request } from "express";

// The request's context, set by ContextModule. Type it at the param: `@Ctx() ctx: AppContext`.
export const Ctx = createParamDecorator(
  (_: unknown, c: ExecutionContext) => c.switchToHttp().getRequest<Request>().ctx,
);
