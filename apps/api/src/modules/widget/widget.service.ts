import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";
import { Widget } from "./widget.entity.js";

@Injectable()
export class WidgetService extends CrudService<Widget> {
  constructor(@InjectRepository(Widget) repo: Repository<Widget>) {
    super(repo);
  }
}
