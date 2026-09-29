import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { env } from "./env.js";
import { dataSourceOptions } from "./infra/database/data-source.js";
import { ensureDatabase } from "./infra/database/ensure-database.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { UserModule } from "./modules/user/user.module.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.DATABASE_URL);
        return { ...dataSourceOptions(env.DATABASE_URL), migrationsRun: env.DB_AUTO_MIGRATE };
      },
    }),
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
