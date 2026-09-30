import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import type { Request } from "express";

import { ApiKey } from "./api-key.entity.js";
import { ApiKeyService } from "./api-key.service.js";

type ApiKeyRequest = Request & { apiKey?: ApiKey };

// Requires a valid `X-API-Key` header. Pair it with @Public() so the global
// AuthGuard doesn't also demand a bearer token.
// ponytail: verifies against the DB on every request; cache (the Go version
// kept keys 1 min) if it shows up in latency.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly service: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const key = request.headers["x-api-key"];
    if (typeof key !== "string" || !key) throw new UnauthorizedException("api key not provided");
    request.apiKey = await this.service.verify(key);
    return true;
  }
}

// The key that authenticated the request, set by ApiKeyGuard.
export const CurrentApiKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ApiKeyRequest>().apiKey,
);
