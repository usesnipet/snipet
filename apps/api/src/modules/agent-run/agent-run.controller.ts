import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";

import { ApiKeyAuth, AppTokenAuth, Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { RateLimit } from "#src/common/rate-limit/rate-limit.js";

import { findAgentRunsParamsSchema, startAgentRunSchema } from "./agent-run.dto.js";
import { AgentRunService } from "./agent-run.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { FindAgentRunsParams, StartAgentRun } from "@snipet/shared";
import type { Response } from "express";
/**
 * Logged-in users, API keys, or app end users (scoped to their own sessions by
 * ctx.owner). Running an agent runs its actions on the host.
 */
@Private(UserAuth(), ApiKeyAuth(), AppTokenAuth())
@Controller("agent-runs")
export class AgentRunController {
  constructor(private readonly service: AgentRunService) {}

  @Get()
  filter(@Ctx() ctx: AppContext, @Query(new ZodPipe(findAgentRunsParamsSchema)) query: FindAgentRunsParams) {
    return this.service.findRuns(ctx, query);
  }

  @Get(":id")
  findById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.findRun(ctx, id);
  }

  @Post()
  @RateLimit("agent-run")
  start(@Ctx() ctx: AppContext, @Body(new ZodPipe(startAgentRunSchema)) dto: StartAgentRun) {
    return this.service.start(ctx, dto);
  }

  @Post(":id/cancel")
  @HttpCode(204)
  cancel(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(ctx, id);
  }

  /**
   * Server-Sent Events: the run's messages after Last-Event-ID, then its live
   * events until run_finished. message events carry the message id as SSE id.
   */
  @Get(":id/events")
  async events(
    @Ctx() ctx: AppContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("last-event-id") lastEventId: string | undefined,
    @Res() res: Response,
  ) {
    const run = await this.service.findRun(ctx, id);
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    try {
      for await (const { event, data } of this.service.follow(ctx, run, Number(lastEventId) || 0, abort.signal)) {
        const sseId = event === "message" ? `id: ${data.id}\n` : "";
        res.write(`${sseId}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    } finally {
      res.end();
    }
  }
}
