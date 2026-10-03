import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { AllowApiKey, Roles, ZodPipe } from "@snipet/server-common";

import { findAgentRunsParamsSchema, startAgentRunSchema } from "./agent-run.dto.js";
import { AgentRunService } from "./agent-run.service.js";
import { CurrentOwner } from "../../common/decorators/owner.decorator.js";

import type { Owner } from "../../common/decorators/owner.decorator.js";
import type { FindAgentRunsParams, StartAgentRun } from "@snipet/shared";
import type { Response } from "express";

// Admins, or any API key: running an agent runs its MCP tools on the host.
@AllowApiKey()
@Roles(Role.Admin)
@Controller("agent-runs")
export class AgentRunController {
  constructor(private readonly service: AgentRunService) {}

  @Get()
  filter(@Query(new ZodPipe(findAgentRunsParamsSchema)) query: FindAgentRunsParams, @CurrentOwner() owner: Owner) {
    return this.service.findRuns(query, owner);
  }

  @Get(":id")
  findById(@Param("id", ParseUUIDPipe) id: string, @CurrentOwner() owner: Owner) {
    return this.service.findRun(id, owner);
  }

  @Post()
  start(@Body(new ZodPipe(startAgentRunSchema)) dto: StartAgentRun, @CurrentOwner() owner: Owner) {
    return this.service.start(dto, owner);
  }

  @Post(":id/cancel")
  @HttpCode(204)
  cancel(@Param("id", ParseUUIDPipe) id: string, @CurrentOwner() owner: Owner) {
    return this.service.cancel(id, owner);
  }

  // Server-Sent Events: the run's messages after Last-Event-ID, then its live
  // events until run_finished. message events carry the message id as SSE id.
  @Get(":id/events")
  async events(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("last-event-id") lastEventId: string | undefined,
    @CurrentOwner() owner: Owner,
    @Res() res: Response,
  ) {
    const run = await this.service.findRun(id, owner);
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    try {
      for await (const { event, data } of this.service.follow(run, Number(lastEventId) || 0, abort.signal)) {
        const sseId = event === "message" ? `id: ${data.id}\n` : "";
        res.write(`${sseId}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    } finally {
      res.end();
    }
  }
}
