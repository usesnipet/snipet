import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmbeddingModule } from "../../infra/embedding/embedding.module.js";
import { PgvectorModule } from "../../infra/pgvector/pgvector.module.js";
import { StorageModule } from "../../infra/storage/storage.module.js";

import { KNOWLEDGE_INDEX_QUEUE, KnowledgeIndexProcessor } from "./queue/knowledge-index.processor.js";
import { KnowledgeItem } from "./knowledge-item.entity.js";
import { KnowledgeItemService } from "./knowledge-item.service.js";
import { KnowledgeSyncProcessor } from "./queue/knowledge-sync.processor.js";
import { KNOWLEDGE_SYNC_QUEUE, KnowledgeSyncService } from "./queue/knowledge-sync.service.js";
import { KnowledgeController } from "./knowledge.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeItem]),
    BullModule.registerQueue({ name: KNOWLEDGE_SYNC_QUEUE }, { name: KNOWLEDGE_INDEX_QUEUE }),
    BullBoardModule.forFeature(
      { name: KNOWLEDGE_SYNC_QUEUE, adapter: BullMQAdapter },
      { name: KNOWLEDGE_INDEX_QUEUE, adapter: BullMQAdapter },
    ),
    EmbeddingModule,
    PgvectorModule,
    StorageModule,
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeItemService, KnowledgeSyncService, KnowledgeSyncProcessor, KnowledgeIndexProcessor],
})
export class KnowledgeModule {}
