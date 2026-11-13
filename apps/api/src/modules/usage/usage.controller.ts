import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Controller, Get, Query } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";
import { Role, usageCallsParamsSchema, usageReportParamsSchema } from "@snipet/shared";

import { UsageService } from "./usage.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { UsageCallsParams, UsageReportParams } from "@snipet/shared";

/** Usage of every agent, so admin only. */
@Private(UserAuth(Role.Admin))
@Controller("usage")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  report(@Ctx() ctx: AppContext, @Query(new ZodPipe(usageReportParamsSchema)) query: UsageReportParams) {
    return this.usageService.report(ctx, query);
  }

  @Get("calls")
  calls(@Ctx() ctx: AppContext, @Query(new ZodPipe(usageCallsParamsSchema)) query: UsageCallsParams) {
    return this.usageService.calls(ctx, query);
  }
}
