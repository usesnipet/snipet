import { ApiKeyAuth, AppTokenAuth, Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";

import { findAgentMessagesParamsSchema, findAgentSessionsSchema } from "./agent-run.dto.js";
import { AgentRunService } from "./agent-run.service.js";

import type { FilterQuery } from "@snipet/server-common";

import type { AgentSession } from "./agent-run.entity.js";
import type { AppContext } from "#src/common/context/app-context.js";
import type { FindAgentMessagesParams } from "@snipet/shared";
@Private(UserAuth(), ApiKeyAuth(), AppTokenAuth())
@Controller("agent-sessions")
export class AgentSessionController {
  constructor(private readonly service: AgentRunService) {}

  @Get()
  filter(@Ctx() ctx: AppContext, @Query(new ZodPipe(findAgentSessionsSchema)) query: FilterQuery<AgentSession>) {
    return this.service.findSessions(ctx, query);
  }

  @Get(":id")
  findById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.findSession(ctx, id);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteById(@Ctx() ctx: AppContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteSession(ctx, id);
  }

  @Get(":id/messages")
  findMessages(
    @Ctx() ctx: AppContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new ZodPipe(findAgentMessagesParamsSchema)) query: FindAgentMessagesParams,
  ) {
    return this.service.findMessages(ctx, id, query);
  }
}
