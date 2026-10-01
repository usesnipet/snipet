import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmbeddingModule } from "../embedding/embedding.module.js";
import { PgvectorModule } from "../pgvector/pgvector.module.js";

import { KNOWLEDGE_INDEX_QUEUE, KnowledgeIndexProcessor } from "./knowledge-index.processor.js";
import { KnowledgeItem } from "./knowledge-item.entity.js";
import { KnowledgeItemService } from "./knowledge-item.service.js";
import { KnowledgeSyncProcessor } from "./knowledge-sync.processor.js";
import { KNOWLEDGE_SYNC_QUEUE, KnowledgeSyncService } from "./knowledge-sync.service.js";
import { KnowledgeController } from "./knowledge.controller.js";
import { S3Source } from "./s3-source.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeItem]),
    BullModule.registerQueue({ name: KNOWLEDGE_SYNC_QUEUE }, { name: KNOWLEDGE_INDEX_QUEUE }),
    EmbeddingModule,
    PgvectorModule,
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeItemService, KnowledgeSyncService, KnowledgeSyncProcessor, KnowledgeIndexProcessor, S3Source],
})
export class KnowledgeModule {}
