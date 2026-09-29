import { Controller } from "@nestjs/common";

import { CrudController } from "../../common/crud/crud.controller";
import { createWidgetSchema, findWidgetsSchema, updateWidgetSchema } from "./widget.dto";
import { Widget } from "./widget.entity";
import { WidgetService } from "./widget.service";

@Controller("widget")
export class WidgetController extends CrudController<Widget>({
  create: createWidgetSchema,
  update: updateWidgetSchema,
  filter: findWidgetsSchema,
}) {
  constructor(service: WidgetService) {
    super(service);
  }
}
