import { BadRequestException, Injectable } from "@nestjs/common";

import { ApiKeyService } from "#src/modules/api-key/api-key.service.js";

import type { Request } from "express";
import type { AuthStrategyHandler, RequestAuth } from "./auth-strategy.js";

/**
 * The API key holder is the app's backend, so it's trusted to say which of
 * its users it acts for.
 */
const EXTERNAL_USER_HEADER = "x-external-user-id";

/** Host backends: `X-API-Key: <key>`. A present but bad key throws. */
@Injectable()
export class ApiKeyStrategy implements AuthStrategyHandler<"apiKey"> {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async authenticate(request: Request): Promise<RequestAuth | null> {
    const key = request.headers["x-api-key"];
    if (typeof key !== "string" || !key) return null;
    const externalUserId = request.headers[EXTERNAL_USER_HEADER];
    if (
      externalUserId !== undefined &&
      (typeof externalUserId !== "string" || !externalUserId || externalUserId.length > 255)
    ) {
      throw new BadRequestException("X-External-User-Id must be a single value of 1 to 255 characters");
    }
    return { type: "apiKey", apiKey: await this.apiKeys.verify(key), externalUserId: externalUserId ?? null };
  }
}
