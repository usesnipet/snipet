import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { knowledgeSearchParamsSchema, Role } from "@snipet/shared";

import { Roles } from "../../common/decorators/auth.decorators.js";
import { ZodPipe } from "../../common/pipes/zod.pipe.js";
import { knowledgeEnabled } from "../../env.js";
import { EmbeddingService } from "../embedding/embedding.service.js";
import { PgvectorService } from "../pgvector/pgvector.service.js";

import { findKnowledgeItemsSchema } from "./knowledge.dto.js";
import { KnowledgeItemService } from "./knowledge-item.service.js";
import { KnowledgeSyncService } from "./knowledge-sync.service.js";

import type { FilterQuery } from "../../common/pagination/filter.js";
import type { KnowledgeItem } from "./knowledge-item.entity.js";
import type { KnowledgeSearchParams } from "@snipet/shared";

// Read-only: items come from the source sync.
@Controller()
export class KnowledgeController {
  constructor(
    private readonly items: KnowledgeItemService,
    private readonly sync: KnowledgeSyncService,
    private readonly embedding: EmbeddingService,
    private readonly pgvector: PgvectorService,
  ) {}

  @Get("knowledge-items")
  filter(@Query(new ZodPipe(findKnowledgeItemsSchema)) query: FilterQuery<KnowledgeItem>) {
    return this.items.filter(query);
  }

  @Get("knowledge-items/:id")
  findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.items.findById(id);
  }

  // Starts a source sync now; it runs in the background.
  @Roles(Role.Admin)
  @Post("knowledge-items/sync")
  @HttpCode(202)
  startSync() {
    this.sync.trigger();
  }

  @Get("knowledge/search")
  async search(@Query(new ZodPipe(knowledgeSearchParamsSchema)) { q, limit }: KnowledgeSearchParams) {
    if (!knowledgeEnabled) throw new ServiceUnavailableException("knowledge is not configured");
    const [embedding] = await this.embedding.embed([q]);
    return this.pgvector.search(q, embedding, limit);
  }
}
