import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthGuard } from "../../common/guards/auth.guard.js";
import { env } from "../../env.js";
import { UserModule } from "../user/user.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { RefreshToken } from "./refresh-token.entity.js";

@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET }), TypeOrmModule.forFeature([RefreshToken]), UserModule],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
