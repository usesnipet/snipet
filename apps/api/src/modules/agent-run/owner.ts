import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { AuthUser } from "../../common/decorators/auth.decorators.js";
import type { ApiKey } from "../api-key/api-key.entity.js";

// Who a session belongs to: the logged-in user or the API key of the request.
export type Owner = { userId: string; apiKeyId: null } | { userId: null; apiKeyId: string };

export const CurrentOwner = createParamDecorator((_: unknown, ctx: ExecutionContext): Owner => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser; apiKey?: ApiKey }>();
  return req.user ? { userId: req.user.id, apiKeyId: null } : { userId: null, apiKeyId: req.apiKey!.id };
});
