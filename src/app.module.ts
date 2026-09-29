import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { env } from "./env";

@Module({
  imports: [TypeOrmModule.forRoot({ url: env.DATABASE_URL })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
