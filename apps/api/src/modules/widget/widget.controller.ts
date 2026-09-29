import { Controller } from "@nestjs/common";

import { CrudController } from "../../common/crud/crud.controller.js";
import { createWidgetSchema, findWidgetsSchema, updateWidgetSchema } from "./widget.dto.js";
import { Widget } from "./widget.entity.js";
import { WidgetService } from "./widget.service.js";

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
