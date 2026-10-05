import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CrudController, Public, Roles } from "@snipet/server-common";
import { Role } from "@snipet/shared";

import { CurrentApiKey } from "../../common/decorators/api-key.decorator.js";

import { createApiKeySchema, findApiKeysSchema, updateApiKeySchema } from "./api-key.dto.js";
import { ApiKey } from "./api-key.entity.js";
import { ApiKeyService } from "./api-key.service.js";

@Roles(Role.Admin)
@Controller("api-keys")
export class ApiKeyController extends CrudController<ApiKey>({
  create: createApiKeySchema,
  update: updateApiKeySchema,
  filter: findApiKeysSchema,
}) {
  constructor(override readonly service: ApiKeyService) {
    super(service);
  }

  @Post(":id/roll")
  roll(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.roll(id);
  }
}

// Called WITH an API key: introspects whichever key authenticated the request.
// Own controller so the admin-only @Roles above doesn't apply.
@Public()
@Controller("api-key")
export class ApiKeyMeController {
  @Get("me")
  me(@CurrentApiKey() apiKey: ApiKey) {
    return apiKey;
  }
}
