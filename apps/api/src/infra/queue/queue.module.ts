import { ExpressAdapter } from "@bull-board/express";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { Redis } from "ioredis";

import { basicAuth } from "@snipet/server-common";
import { env } from "../../env.js";

// BullMQ connection and Bull Board at /api/queues. Each module registers its
// own queues, on the board too, with BullBoardModule.forFeature.
@Module({
  imports: [
    // BullMQ can't load ioredis itself under ESM, so it gets a client.
    BullModule.forRoot({ connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) }),
    BullBoardModule.forRoot({
      route: "/queues",
      adapter: ExpressAdapter,
      middleware: basicAuth(env.BULL_BOARD_USERNAME, env.BULL_BOARD_PASSWORD, "Bull Board"),
    }),
  ],
})
export class QueueModule {}
