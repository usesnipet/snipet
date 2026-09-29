import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { WidgetController } from "./widget.controller";
import { Widget } from "./widget.entity";
import { WidgetService } from "./widget.service";

@Module({
  imports: [TypeOrmModule.forFeature([Widget])],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
