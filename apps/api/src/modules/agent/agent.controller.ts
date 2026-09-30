import { Controller } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController } from "../../common/crud/crud.controller.js";
import { Roles } from "../../common/decorators/auth.decorators.js";

import { createAgentSchema, findAgentsSchema, updateAgentSchema } from "./agent.dto.js";
import { Agent } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

// Admin only: agents run MCP server tools, which act on the host.
@Roles(Role.Admin)
@Controller("agents")
export class AgentController extends CrudController<Agent>({
  create: createAgentSchema,
  update: updateAgentSchema,
  filter: findAgentsSchema,
}) {
  constructor(override readonly service: AgentService) {
    super(service);
  }
}
