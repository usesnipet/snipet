import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Public, ZodPipe } from "@snipet/server-common";
import { createAppTokenSchema } from "@snipet/shared";
import type { z } from "zod";

import { CurrentApiKey } from "../../common/decorators/api-key.decorator.js";
import { ApiKeyGuard } from "../../common/guards/api-key.guard.js";
import type { ApiKey } from "../api-key/api-key.entity.js";

import { AppTokenService } from "./app-token.service.js";

// API key only: @Public() skips the bearer check, ApiKeyGuard demands the key.
// The token belongs to the key's app.
@Public()
@UseGuards(ApiKeyGuard)
@Controller("app-tokens")
export class AppTokenController {
  constructor(private readonly service: AppTokenService) {}

  @Post()
  create(
    @CurrentApiKey() apiKey: ApiKey,
    @Body(new ZodPipe(createAppTokenSchema)) dto: z.output<typeof createAppTokenSchema>,
  ) {
    return this.service.create(apiKey, dto);
  }
}
