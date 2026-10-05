import { Controller } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController, Roles } from "@snipet/server-common";

import { createAppSchema, findAppsSchema, updateAppSchema } from "./app.dto.js";
import { App } from "./app.entity.js";
import { AppService } from "./app.service.js";

@Roles(Role.Admin)
@Controller("apps")
export class AppController extends CrudController<App>({
  create: createAppSchema,
  update: updateAppSchema,
  filter: findAppsSchema,
}) {
  constructor(override readonly service: AppService) {
    super(service);
  }
}
