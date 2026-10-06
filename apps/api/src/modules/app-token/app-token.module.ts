import { Module } from "@nestjs/common";

import { ApiKeyModule } from "../api-key/api-key.module.js";
import { AppsModule } from "../app/app.module.js";
import { AuthModule } from "../auth/auth.module.js";

import { AppTokenController } from "./app-token.controller.js";
import { AppTokenService } from "./app-token.service.js";

@Module({
  imports: [ApiKeyModule, AppsModule, AuthModule],
  controllers: [AppTokenController],
  providers: [AppTokenService],
})
export class AppTokenModule {}
