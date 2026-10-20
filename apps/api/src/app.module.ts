import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ensureDatabase } from "@snipet/server-common";
import { AuthGuard } from "#src/common/guards/auth.guard.js";
import { ApiKeyStrategy } from "#src/common/guards/strategies/api-key.strategy.js";
import { AppTokenStrategy } from "#src/common/guards/strategies/app-token.strategy.js";
import { UserStrategy } from "#src/common/guards/strategies/user.strategy.js";
import { RateLimitModule } from "#src/common/rate-limit/rate-limit.js";
import { env } from "#src/env.js";
import { dataSourceOptions } from "#src/infra/database/data-source.js";
import { AgentRunModule } from "#src/modules/agent-run/agent-run.module.js";
import { AgentModule } from "#src/modules/agent/agent.module.js";
import { ApiKeyModule } from "#src/modules/api-key/api-key.module.js";
import { AppsModule } from "#src/modules/app/app.module.js";
import { AuthModule } from "#src/modules/auth/auth.module.js";
import { FilesModule } from "#src/modules/files/files.module.js";
import { LlmConnectionModule } from "#src/modules/llm-connection/llm-connection.module.js";
import { PluginConnectionModule } from "#src/modules/plugin-connection/plugin-connection.module.js";
import { SettingsModule } from "#src/modules/settings/settings.module.js";
import { SystemModule } from "#src/modules/system/system.module.js";
import { UserModule } from "#src/modules/user/user.module.js";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RateLimitModule,
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.DATABASE_URL);
        return { ...dataSourceOptions(env.DATABASE_URL), migrationsRun: env.DB_AUTO_MIGRATE };
      },
    }),
    AgentModule,
    AgentRunModule,
    ApiKeyModule,
    AppsModule,
    AuthModule,
    FilesModule,
    LlmConnectionModule,
    PluginConnectionModule,
    SettingsModule,
    SystemModule,
    UserModule,
  ],
  // In this order: some throttlers track the caller AuthGuard sets.
  providers: [
    UserStrategy,
    ApiKeyStrategy,
    AppTokenStrategy,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
