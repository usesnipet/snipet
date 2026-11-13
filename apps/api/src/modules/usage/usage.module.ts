import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UsageRecord } from "./usage-record.entity.js";
import { UsageController } from "./usage.controller.js";
import { UsageService } from "./usage.service.js";

/** The LLM usage ledger: runs write it through the core's UsageStore, admins read its report here. */
@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord])],
  controllers: [UsageController],
  providers: [UsageService],
})
export class UsageModule {}
