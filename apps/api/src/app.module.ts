import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { WidgetModule } from "./modules/widget/widget.module.js";
import { env } from "./env.js";
import { dataSourceOptions } from "./infra/database/data-source.js";
import { ensureDatabase } from "./infra/database/ensure-database.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.DATABASE_URL);
        return { ...dataSourceOptions(env.DATABASE_URL), migrationsRun: env.DB_AUTO_MIGRATE };
      },
    }),
    WidgetModule,
  ],
})
export class AppModule {}
