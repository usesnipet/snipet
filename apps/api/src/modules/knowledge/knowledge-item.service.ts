import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CrudService } from "../../common/crud/crud.service.js";

import { KnowledgeItem } from "./knowledge-item.entity.js";

@Injectable()
export class KnowledgeItemService extends CrudService<KnowledgeItem> {
  constructor(@InjectRepository(KnowledgeItem) repo: Repository<KnowledgeItem>) {
    super(repo);
  }
}
