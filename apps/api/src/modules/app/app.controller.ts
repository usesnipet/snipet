import { Body, Controller, Post } from "@nestjs/common";
import { CrudController, ZodPipe } from "@snipet/server-common";
import { issueAppTokenSchema, Role } from "@snipet/shared";

import { ApiKeyAuth, CurrentApiKey, Private, UserAuth } from "../../common/decorators/auth.decorator.js";

import { createAppSchema, findAppsSchema, updateAppSchema } from "./app.dto.js";
import { App } from "./app.entity.js";
import { AppService } from "./app.service.js";

import type { z } from "zod";
import type { ApiKey } from "../api-key/api-key.entity.js";

@Private(UserAuth(Role.Admin))
@Controller("apps")
export class AppController extends CrudController<App>({
  create: createAppSchema,
  update: updateAppSchema,
  filter: findAppsSchema,
}) {
  constructor(override readonly service: AppService) {
    super(service);
  }

  @Private(ApiKeyAuth())
  @Post("issue-token")
  issueToken(
    @CurrentApiKey() apiKey: ApiKey,
    @Body(new ZodPipe(issueAppTokenSchema)) dto: z.output<typeof issueAppTokenSchema>,
  ) {
    return this.service.issueToken(apiKey, dto);
  }
}
