import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthGuard } from "./common/guards/auth.guard.js";
import { env } from "./env.js";
import { dataSourceOptions } from "./infra/database/data-source.js";
import { ensureDatabase } from "./infra/database/ensure-database.js";
import { AgentRunModule } from "./modules/agent-run/agent-run.module.js";
import { AgentModule } from "./modules/agent/agent.module.js";
import { ApiKeyModule } from "./modules/api-key/api-key.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module.js";
import { LlmConnectionModule } from "./modules/llm-connection/llm-connection.module.js";
import { McpServerModule } from "./modules/mcp-server/mcp-server.module.js";
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
