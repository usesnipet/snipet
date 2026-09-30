import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { env } from "../../env.js";
import { UserModule } from "../user/user.module.js";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { RefreshToken } from "./refresh-token.entity.js";

@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET }), TypeOrmModule.forFeature([RefreshToken]), UserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
