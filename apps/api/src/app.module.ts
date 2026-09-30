import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { env } from "./env.js";
import { dataSourceOptions } from "./infra/database/data-source.js";
import { ensureDatabase } from "./infra/database/ensure-database.js";
import { ApiKeyModule } from "./modules/api-key/api-key.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { LlmConnectionModule } from "./modules/llm-connection/llm-connection.module.js";
import { SystemModule } from "./modules/system/system.module.js";
import { UserModule } from "./modules/user/user.module.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.DATABASE_URL);
        return { ...dataSourceOptions(env.DATABASE_URL), migrationsRun: env.DB_AUTO_MIGRATE };
      },
    }),
    ApiKeyModule,
    AuthModule,
    LlmConnectionModule,
    SystemModule,
    UserModule,
  ],
})
export class AppModule {}
