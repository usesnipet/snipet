import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CrudService } from "@snipet/server-common";

import { App } from "./app.entity.js";

@Injectable()
export class AppService extends CrudService<App> {
  constructor(@InjectRepository(App) repo: Repository<App>) {
    super(repo);
  }
}
