import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmbeddingModule } from "../embedding/embedding.module.js";
import { PgvectorModule } from "../pgvector/pgvector.module.js";

import { KnowledgeIndexService } from "./knowledge-index.service.js";
import { KnowledgeItem } from "./knowledge-item.entity.js";
import { KnowledgeItemService } from "./knowledge-item.service.js";
import { KnowledgeSyncService } from "./knowledge-sync.service.js";
import { KnowledgeController } from "./knowledge.controller.js";
import { S3Source } from "./s3-source.js";

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem]), EmbeddingModule, PgvectorModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeItemService, KnowledgeIndexService, KnowledgeSyncService, S3Source],
})
export class KnowledgeModule {}
