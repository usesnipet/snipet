import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmbeddingModule } from "../../infra/embedding/embedding.module.js";
import { PgvectorModule } from "../../infra/pgvector/pgvector.module.js";
import { StorageModule } from "../../infra/storage/storage.module.js";

import { KnowledgeIndexerService } from "./indexing/knowledge-indexer.service.js";
import { KnowledgeSyncService } from "./indexing/knowledge-sync.service.js";
import { KnowledgeItem } from "./knowledge-item.entity.js";
import { KnowledgeController } from "./knowledge.controller.js";
import { KnowledgeService } from "./knowledge.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem]), EmbeddingModule, PgvectorModule, StorageModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeSyncService, KnowledgeIndexerService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
