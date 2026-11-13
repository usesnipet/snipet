import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UsageRecord } from "./usage-record.entity.js";

/** The LLM usage ledger. Runs write it through the core's UsageStore. */
@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord])],
})
export class UsageModule {}
