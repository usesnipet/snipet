import { ApiKeyAuth, Private, Public, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { RateLimit } from "#src/common/rate-limit/rate-limit.js";
import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CrudController, Ctx, ZodPipe } from "@snipet/server-common";
import { issueAnonymousTokenSchema, issueAppTokenSchema, Role } from "@snipet/shared";

import { createAppSchema, findAppsSchema, updateAppSchema } from "./app.dto.js";
import { App } from "./app.entity.js";
import { AppService } from "./app.service.js";

import type { z } from "zod";
import type { AppContext } from "#src/common/context/app-context.js";

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
    @Ctx() ctx: AppContext,
    @Body(new ZodPipe(issueAppTokenSchema)) dto: z.output<typeof issueAppTokenSchema>,
  ) {
    return this.service.issueToken(ctx, ctx.apiKey.appId, dto);
  }

  /** Name and such for the widget, before any token exists. */
  @Public()
  @Get(":id/public")
  async findPublic(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string, @Headers("origin") origin?: string) {
    const app = await this.service.findPublic(ctx, id, origin);
    return { id: app.id, name: app.name };
  }

  /** The widget's own login for apps with allowAnonymous on; no host backend involved. */
  @Public()
  @Post(":id/anonymous-token")
  @RateLimit("anonymous-signup")
  issueAnonymousToken(
    @Ctx() ctx: AppContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("origin") origin: string | undefined,
    @Body(new ZodPipe(issueAnonymousTokenSchema)) dto: z.output<typeof issueAnonymousTokenSchema>,
  ) {
    return this.service.issueAnonymousToken(ctx, id, origin, dto.refreshToken);
  }
}
