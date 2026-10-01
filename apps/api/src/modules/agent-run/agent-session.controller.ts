import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { AllowApiKey, Roles } from "../../common/decorators/auth.decorators.js";
import { ZodPipe } from "../../common/pipes/zod.pipe.js";

import { findAgentMessagesParamsSchema, findAgentSessionsSchema } from "./agent-run.dto.js";
import { AgentRunService } from "./agent-run.service.js";
import { CurrentOwner } from "../../common/decorators/owner.decorator.js";

import type { FilterQuery } from "../../common/pagination/filter.js";
import type { AgentSession } from "./agent-run.entity.js";
import type { Owner } from "../../common/decorators/owner.decorator.js";
import type { FindAgentMessagesParams } from "@snipet/shared";

// Same access as running agents: admins, or any API key.
@AllowApiKey()
@Roles(Role.Admin)
@Controller("agent-sessions")
export class AgentSessionController {
  constructor(private readonly service: AgentRunService) {}

  @Get()
  filter(@Query(new ZodPipe(findAgentSessionsSchema)) query: FilterQuery<AgentSession>, @CurrentOwner() owner: Owner) {
    return this.service.findSessions(query, owner);
  }

  @Get(":id")
  findById(@Param("id", ParseUUIDPipe) id: string, @CurrentOwner() owner: Owner) {
    return this.service.findSession(id, owner);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteById(@Param("id", ParseUUIDPipe) id: string, @CurrentOwner() owner: Owner) {
    return this.service.deleteSession(id, owner);
  }

  @Get(":id/messages")
  findMessages(
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new ZodPipe(findAgentMessagesParamsSchema)) query: FindAgentMessagesParams,
    @CurrentOwner() owner: Owner,
  ) {
    return this.service.findMessages(id, query, owner);
  }
}
