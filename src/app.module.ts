import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { WidgetModule } from "./modules/widget/widget.module";
import { env } from "./env";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      url: env.DATABASE_URL,
      autoLoadEntities: true,
    }),
    WidgetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
