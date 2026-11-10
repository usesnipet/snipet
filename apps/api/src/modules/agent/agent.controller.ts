import { Controller, Get, Query } from "@nestjs/common";
import { CrudController, Ctx, ZodPipe } from "@snipet/server-common";
import { Role } from "@snipet/shared";

import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";

import { createAgentSchema, findAgentsSchema, updateAgentSchema } from "./agent.dto.js";
import { Agent } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { FilterQuery } from "@snipet/server-common";

/** Admin only: agents run actions, which act on the host. */
@Private(UserAuth(Role.Admin))
@Controller("agents")
export class AgentController extends CrudController<Agent, AppContext>({
  create: createAgentSchema,
  update: updateAgentSchema,
}) {
  constructor(override readonly service: AgentService) {
    super(service);
  }

  override serialize(ctx: AppContext, agent: Agent) {
    return this.service.mask(ctx, agent);
  }

  /** Summaries, not whole agents: the full data only comes from GET /agents/:id. */
  @Get()
  override filter(@Ctx() ctx: AppContext, @Query(new ZodPipe(findAgentsSchema)) query: FilterQuery<Agent>) {
    return this.service.findSummaries(ctx, query);
  }

  /** What the chat's agent picker shows any logged-in user: no prompt, LLMs or plugin settings. */
  @Private(UserAuth())
  @Get("available")
  findAvailable(@Ctx() ctx: AppContext) {
    return this.service.findAvailable(ctx);
  }
}
