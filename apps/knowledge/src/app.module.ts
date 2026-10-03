import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ensureDatabase } from "@snipet/server-common";

import { env } from "./env.js";
import { dataSourceOptions } from "./infra/database/data-source.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.KNOWLEDGE_DATABASE_URL);
        return { ...dataSourceOptions(env.KNOWLEDGE_DATABASE_URL), migrationsRun: env.DB_AUTO_MIGRATE };
      },
    }),
  ],
})
export class AppModule {}
