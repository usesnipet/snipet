import { Body, Controller, Post } from "@nestjs/common";
import { ZodPipe } from "@snipet/server-common";
import { createAppTokenSchema } from "@snipet/shared";
import type { z } from "zod";

import { ApiKeyAuth, Private, CurrentApiKey } from "../../common/decorators/auth.decorator.js";
import type { ApiKey } from "../api-key/api-key.entity.js";

import { AppTokenService } from "./app-token.service.js";

// API key only: the token belongs to the key's app.
@Private(ApiKeyAuth())
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
