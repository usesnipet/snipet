import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { Public, Roles, ZodPipe } from "@snipet/server-common";
import { knowledgeSearchParamsSchema, Role } from "@snipet/shared";

import { KnowledgeSyncService } from "./indexing/knowledge-sync.service.js";
import { KnowledgeItemService } from "./knowledge-item.service.js";
import { findKnowledgeItemsSchema } from "./knowledge.dto.js";

import type { FilterQuery } from "@snipet/server-common";

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
  startSync() {
    void this.sync.sync();
  }

  @Public()
  @Get("knowledge/search")
  search(@Query(new ZodPipe(knowledgeSearchParamsSchema)) { q, limit }: KnowledgeSearchParams) {
    return this.items.search(q, limit);
  }
}
