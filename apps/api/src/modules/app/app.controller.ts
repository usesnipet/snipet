import { Controller } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController } from "@snipet/server-common";

import { createAppSchema, findAppsSchema, updateAppSchema } from "./app.dto.js";
import { App } from "./app.entity.js";
import { AppService } from "./app.service.js";
import { Private, UserAuth } from "../../common/decorators/auth.decorator.js";

@Private(UserAuth(Role.Admin))
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
