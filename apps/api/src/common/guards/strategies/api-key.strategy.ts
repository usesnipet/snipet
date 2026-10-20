import { Injectable } from "@nestjs/common";

import { ApiKeyService } from "#src/modules/api-key/api-key.service.js";

import type { Request } from "express";
import type { AuthStrategyHandler, RequestAuth } from "./auth-strategy.js";

/** Host backends: `X-API-Key: <key>`. A present but bad key throws. */
@Injectable()
export class ApiKeyStrategy implements AuthStrategyHandler<"apiKey"> {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async authenticate(request: Request): Promise<RequestAuth | null> {
    const key = request.headers["x-api-key"];
    if (typeof key !== "string" || !key) return null;
    return { type: "apiKey", apiKey: await this.apiKeys.verify(key) };
  }
}
