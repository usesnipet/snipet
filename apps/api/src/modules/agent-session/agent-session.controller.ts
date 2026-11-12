import { ApiKeyAuth, AppTokenAuth, Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { CrudController, Ctx, ZodPipe } from "@snipet/server-common";

import { findAgentMessagesParamsSchema, findAgentSessionsSchema } from "./agent-session.dto.js";
import { AgentSession } from "./agent-session.entity.js";
import { AgentSessionService } from "./agent-session.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { FindAgentMessagesParams } from "@snipet/shared";

/** The caller's sessions: read and delete only, as a session is created by starting a run. */
@Private(UserAuth(), ApiKeyAuth(), AppTokenAuth())
@Controller("agent-sessions")
export class AgentSessionController extends CrudController<AgentSession, AppContext>({
  filter: findAgentSessionsSchema,
  except: ["create", "updateById"],
}) {
  constructor(override readonly service: AgentSessionService) {
    super(service);
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
