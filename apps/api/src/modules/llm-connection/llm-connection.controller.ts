import { Controller } from "@nestjs/common";

import { CrudController } from "../../common/crud/crud.controller.js";

import {
  createLlmConnectionSchema,
  findLlmConnectionsSchema,
  updateLlmConnectionSchema,
} from "./llm-connection.dto.js";
import { LlmConnection } from "./llm-connection.entity.js";
import { LlmConnectionService } from "./llm-connection.service.js";

@Controller("llm-connections")
export class LlmConnectionController extends CrudController<LlmConnection>({
  create: createLlmConnectionSchema,
  update: updateLlmConnectionSchema,
  filter: findLlmConnectionsSchema,
}) {
  constructor(service: LlmConnectionService) {
    super(service);
  }
}
