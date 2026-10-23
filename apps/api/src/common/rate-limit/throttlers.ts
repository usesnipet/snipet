import { env } from "#src/env.js";
import { Request } from "express";

import type { ExecutionContext } from "@nestjs/common";
import type { ThrottlerOptions } from "@nestjs/throttler";
import type { RequestAuth } from "../guards/strategies/auth-strategy.js";
/** A named limit: applies where @RateLimit lists it, or on every route when `global`. */
export type ThrottlerConfig = Omit<ThrottlerOptions, "name"> & { global?: boolean };

type Req = Request & { auth?: RequestAuth };
const request = (ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Every limit the API has; the keys are what @RateLimit takes. */
export const throttlers = {
  "anonymous-signup": {
    limit: env.ANONYMOUS_SIGNUPS_PER_IP_PER_HOUR,
    ttl: HOUR,
  },
  "agent-run": {
    limit: env.AGENT_RUNS_PER_END_USER_PER_MINUTE,
    ttl: MINUTE,
    skipIf: (ctx) => request(ctx).auth?.type !== "appToken",
    getTracker: (req: Record<string, any>) => {
      const r = req as Req;
      return r.auth?.type === "appToken" ? `${r.auth.token.app.id}:${r.auth.token.sub}` : "";
    },
  },
} satisfies Record<string, ThrottlerConfig>;

export type ThrottlerName = keyof typeof throttlers;
