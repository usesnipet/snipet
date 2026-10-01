import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Redis } from "ioredis";

import { AuthGuard } from "./common/guards/auth.guard.js";
import { basicAuth } from "./common/middleware/basic-auth.middleware.js";
import { env } from "./env.js";
import { dataSourceOptions } from "./infra/database/data-source.js";
import { ensureDatabase } from "./infra/database/ensure-database.js";
import { AgentRunModule } from "./modules/agent-run/agent-run.module.js";
import { AgentModule } from "./modules/agent/agent.module.js";
import { ApiKeyModule } from "./modules/api-key/api-key.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { KNOWLEDGE_INDEX_QUEUE } from "./modules/knowledge/knowledge-index.processor.js";
import { KNOWLEDGE_SYNC_QUEUE } from "./modules/knowledge/knowledge-sync.service.js";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module.js";
import { LlmConnectionModule } from "./modules/llm-connection/llm-connection.module.js";
import { McpServerModule } from "./modules/mcp-server/mcp-server.module.js";
import { MCP_SYNC_QUEUE } from "./modules/mcp-server/mcp-server.sync.processor.js";
import { SystemModule } from "./modules/system/system.module.js";
import { ToolModule } from "./modules/tool/tool.module.js";
import { UserModule } from "./modules/user/user.module.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.DATABASE_URL);
        return { ...dataSourceOptions(env.DATABASE_URL), migrationsRun: env.DB_AUTO_MIGRATE };
      },
    }),
    BullModule.forRoot({ connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) }),
    BullBoardModule.forRoot({
      route: "/queues",
      adapter: ExpressAdapter,
      middleware: basicAuth(env.BULL_BOARD_USERNAME, env.BULL_BOARD_PASSWORD, "Bull Board"),
    }),
    BullBoardModule.forFeature(
      { name: MCP_SYNC_QUEUE, adapter: BullMQAdapter },
      { name: KNOWLEDGE_SYNC_QUEUE, adapter: BullMQAdapter },
      { name: KNOWLEDGE_INDEX_QUEUE, adapter: BullMQAdapter },
    ),
    AgentModule,
    AgentRunModule,
    ApiKeyModule,
    AuthModule,
    KnowledgeModule,
    LlmConnectionModule,
    McpServerModule,
    SystemModule,
    ToolModule,
    UserModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
