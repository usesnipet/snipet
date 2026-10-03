import { Controller } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController, Roles } from "@snipet/server-common";
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
