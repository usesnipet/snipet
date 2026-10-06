import { Controller } from "@nestjs/common";
import { Role } from "@snipet/shared";

import { CrudController } from "@snipet/server-common";
import { createUserSchema, findUsersSchema, updateUserSchema } from "./user.dto.js";
import { User } from "./user.entity.js";
import { UserService } from "./user.service.js";
import { Private, UserAuth } from "../../common/decorators/auth.decorator.js";

@Private(UserAuth(Role.Admin))
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
