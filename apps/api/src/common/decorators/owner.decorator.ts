import { BadRequestException, createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { AuthUser } from "@snipet/server-common";
import type { Request } from "express";
import type { ApiKey } from "../../modules/api-key/api-key.entity.js";

// Who a session belongs to: the logged-in user, or the app of the request's
// API key, optionally on behalf of one of its end users.
export type Owner =
  | { userId: string; appId: null; externalUserId: null }
  | { userId: null; appId: string; externalUserId: string | null };

// The API key holder is the app's backend, so it's trusted to say which of
// its users it acts for.
const EXTERNAL_USER_HEADER = "x-external-user-id";

export const CurrentOwner = createParamDecorator((_: unknown, ctx: ExecutionContext): Owner => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser; apiKey?: ApiKey }>();
  if (req.user) return { userId: req.user.id, appId: null, externalUserId: null };

  const externalUserId = req.headers[EXTERNAL_USER_HEADER];
  if (
    externalUserId !== undefined &&
    (typeof externalUserId !== "string" || !externalUserId || externalUserId.length > 255)
  ) {
    throw new BadRequestException("X-External-User-Id must be a single value of 1 to 255 characters");
  }
  return { userId: null, appId: req.apiKey!.appId, externalUserId: externalUserId ?? null };
});
