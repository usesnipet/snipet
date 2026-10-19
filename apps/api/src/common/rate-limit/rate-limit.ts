import { SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { throttlers } from "./throttlers.js";

import type { ExecutionContext } from "@nestjs/common";
import type { ThrottlerConfig, ThrottlerName } from "./throttlers.js";

const RATE_LIMIT = "rate-limit";

/** On a class or method (both lists apply): the throttlers this route counts against. */
export const RateLimit = (...names: ThrottlerName[]) => SetMetadata(RATE_LIMIT, names);

const reflector = new Reflector();
const routeThrottlers = (ctx: ExecutionContext) =>
  reflector.getAllAndMerge<ThrottlerName[]>(RATE_LIMIT, [ctx.getHandler(), ctx.getClass()]) ?? [];

/**
 * ThrottlerModule over the `throttlers` registry. Nest applies every throttler
 * on every guarded route; folding the opt-in into skipIf makes them apply only
 * where @RateLimit lists them (or everywhere when global), with no guard of our own.
 * Pair it with ThrottlerGuard as an APP_GUARD after AuthGuard.
 */
export const RateLimitModule = ThrottlerModule.forRoot({
  throttlers: (Object.entries(throttlers) as [ThrottlerName, ThrottlerConfig][]).map(
    ([name, { global, skipIf, ...options }]) => ({
      name,
      ...options,
      skipIf: (ctx: ExecutionContext) => (!global && !routeThrottlers(ctx).includes(name)) || !!skipIf?.(ctx),
    }),
  ),
});
