import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module.js";

import { AppController } from "./app.controller.js";
import { App } from "./app.entity.js";
import { AppService } from "./app.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([App]), AuthModule],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppsModule {}
