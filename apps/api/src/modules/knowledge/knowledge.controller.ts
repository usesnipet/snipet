import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { knowledgeSearchParamsSchema, Role } from "@snipet/shared";

import { Public, Roles } from "../../common/decorators/auth.decorators.js";
import { ZodPipe } from "../../common/pipes/zod.pipe.js";

import { KnowledgeItemService } from "./knowledge-item.service.js";
import { findKnowledgeItemsSchema } from "./knowledge.dto.js";
import { KnowledgeSyncService } from "./queue/knowledge-sync.service.js";

import type { FilterQuery } from "../../common/pagination/filter.js";
import type { KnowledgeItem } from "./knowledge-item.entity.js";
import type { KnowledgeSearchParams } from "@snipet/shared";

// Read-only: items come from the source sync.
@Controller()
export class KnowledgeController {
  constructor(
    private readonly items: KnowledgeItemService,
    private readonly sync: KnowledgeSyncService,
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
  async startSync() {
    await this.sync.trigger();
  }

  @Public()
  @Get("knowledge/search")
  search(@Query(new ZodPipe(knowledgeSearchParamsSchema)) { q, limit }: KnowledgeSearchParams) {
    return this.items.search(q, limit);
  }
}
