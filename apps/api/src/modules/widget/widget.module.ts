import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { WidgetController } from "./widget.controller.js";
import { Widget } from "./widget.entity.js";
import { WidgetService } from "./widget.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Widget])],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
