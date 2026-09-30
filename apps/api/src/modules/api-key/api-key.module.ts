import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ApiKeyController, ApiKeyMeController } from "./api-key.controller.js";
import { ApiKey } from "./api-key.entity.js";
import { ApiKeyGuard } from "./api-key.guard.js";
import { ApiKeyService } from "./api-key.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeyController, ApiKeyMeController],
  providers: [ApiKeyService, ApiKeyGuard],
  exports: [ApiKeyService, ApiKeyGuard],
})
export class ApiKeyModule {}
