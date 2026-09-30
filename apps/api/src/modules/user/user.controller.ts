import { Controller } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController } from "../../common/crud/crud.controller.js";
import { Roles } from "../../common/decorators/auth.decorators.js";
import { createUserSchema, findUsersSchema, updateUserSchema } from "./user.dto.js";
import { User } from "./user.entity.js";
import { UserService } from "./user.service.js";

@Roles(Role.Admin)
@Controller("users")
export class UserController extends CrudController<User>({
  create: createUserSchema,
  update: updateUserSchema,
  filter: findUsersSchema,
}) {
  constructor(service: UserService) {
    super(service);
  }
}
