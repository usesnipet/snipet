import { Controller } from "@nestjs/common";
import { CrudController } from "@snipet/server-common";
import { Role } from "@snipet/shared";

import { Private, UserAuth } from "../../common/decorators/auth.decorator.js";

import { createAgentSchema, findAgentsSchema, updateAgentSchema } from "./agent.dto.js";
import { Agent } from "./agent.entity.js";
import { AgentService } from "./agent.service.js";

// Admin only: agents run actions, which act on the host.
@Private(UserAuth(Role.Admin))
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
