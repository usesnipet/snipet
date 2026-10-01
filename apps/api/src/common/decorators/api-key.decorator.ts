import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { ApiKey } from "../../modules/api-key/api-key.entity.js";

// The key that authenticated the request, set by ApiKeyGuard.
export const CurrentApiKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<{ apiKey?: ApiKey }>().apiKey,
);
