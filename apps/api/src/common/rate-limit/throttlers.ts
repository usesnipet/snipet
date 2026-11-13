import { env } from "#src/env.js";
import { Request } from "express";

import type { ExecutionContext } from "@nestjs/common";
import type { ThrottlerOptions } from "@nestjs/throttler";
import type { AppContext } from "../context/app-context.js";
/** A named limit: applies where @RateLimit lists it, or on every route when `global`. */
export type ThrottlerConfig = Omit<ThrottlerOptions, "name"> & { global?: boolean };

type Req = Request & { ctx: AppContext };
const request = (ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Whoever is calling: the credential when there is one, so callers behind one NAT don't share a count. */
const caller = (req: Record<string, any>) => {
  const auth = (req as Req).ctx?.auth;
  switch (auth?.type) {
    case "user":
      return `user:${auth.user.id}`;
    case "apiKey":
      return `apiKey:${auth.apiKey.id}`;
    case "appToken":
      return `appToken:${auth.token.app.id}:${auth.token.sub}`;
    default:
      return `ip:${(req as Req).ip}`;
  }
};

/** Every limit the API has; the keys are what @RateLimit takes. */
export const throttlers = {
  // ponytail: in-memory counts are per instance; use a Redis storage once the API runs more than one.
  global: {
    global: true,
    limit: env.REQUESTS_PER_CALLER_PER_MINUTE,
    ttl: MINUTE,
    getTracker: caller,
  },
  "anonymous-signup": {
    limit: env.ANONYMOUS_SIGNUPS_PER_IP_PER_HOUR,
    ttl: HOUR,
  },
  "agent-run": {
    limit: env.AGENT_RUNS_PER_END_USER_PER_MINUTE,
    ttl: MINUTE,
    skipIf: (ctx) => request(ctx).ctx.auth?.type !== "appToken",
    getTracker: (req: Record<string, any>) => {
      const auth = (req as Req).ctx.auth;
      return auth?.type === "appToken" ? `${auth.token.app.id}:${auth.token.sub}` : "";
    },
  },
} satisfies Record<string, ThrottlerConfig>;

export type ThrottlerName = keyof typeof throttlers;
