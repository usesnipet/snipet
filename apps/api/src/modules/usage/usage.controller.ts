import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Controller, Get, Query } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";
import { Role, usageRunsParamsSchema, usageReportParamsSchema } from "@snipet/shared";

import { UsageService } from "./usage.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { UsageReportParams, UsageRunsParams } from "@snipet/shared";

/** Usage of every agent, so admin only. */
@Private(UserAuth(Role.Admin))
@Controller("usage")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  report(@Ctx() ctx: AppContext, @Query(new ZodPipe(usageReportParamsSchema)) query: UsageReportParams) {
    return this.usageService.report(ctx, query);
  }

  @Get("runs")
  runs(@Ctx() ctx: AppContext, @Query(new ZodPipe(usageRunsParamsSchema)) query: UsageRunsParams) {
    return this.usageService.runs(ctx, query);
  }
}
