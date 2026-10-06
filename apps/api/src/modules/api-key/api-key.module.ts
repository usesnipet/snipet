import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ApiKeyController, ApiKeyMeController } from "./api-key.controller.js";
import { ApiKey } from "./api-key.entity.js";
import { ApiKeyService } from "./api-key.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeyController, ApiKeyMeController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
