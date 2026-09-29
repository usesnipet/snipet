import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { WidgetModule } from "./modules/widget/widget.module";
import { env } from "./env";
import { ensureDatabase } from "./infra/database/ensure-database";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabase(env.DATABASE_URL);
        return { type: "postgres", url: env.DATABASE_URL, autoLoadEntities: true };
      },
    }),
    WidgetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
