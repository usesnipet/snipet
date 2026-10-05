import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CrudService } from "@snipet/server-common";
import { Repository } from "typeorm";

import { EmbeddingService } from "../../infra/embedding/embedding.service.js";
import { PgvectorService } from "../../infra/pgvector/pgvector.service.js";

import { KnowledgeItem } from "./knowledge-item.entity.js";
import { knowledgeEnabled } from "./utils.js";

@Injectable()
export class KnowledgeItemService extends CrudService<KnowledgeItem> {
  constructor(
    @InjectRepository(KnowledgeItem) repo: Repository<KnowledgeItem>,
    private readonly embedding: EmbeddingService,
    private readonly pgvector: PgvectorService,
  ) {
    super(repo);
  }

  async search(q: string, limit: number) {
    if (!knowledgeEnabled()) throw new ServiceUnavailableException("knowledge is not configured");
    const [embedding] = await this.embedding.embed([q]);
    return this.pgvector.search(q, embedding, limit);
  }
}
