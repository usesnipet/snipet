import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgeItems1790792218463 implements MigrationInterface {
  name = "KnowledgeItems1790792218463";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "knowledge_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "externalId" character varying(1024) NOT NULL, "name" text NOT NULL, "hash" character varying(128) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "kind" character varying(32), "status" character varying(20) NOT NULL DEFAULT 'pending', "reason" text, "lastError" text, "indexedAt" TIMESTAMP WITH TIME ZONE, "lastModified" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4da6043fefe372aa8151664e3b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c9cdd12a179c280a6adab5c9c6" ON "knowledge_items"  ("externalId") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_33968f7d84d12a425dc98168e0" ON "knowledge_items"  ("status") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_33968f7d84d12a425dc98168e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c9cdd12a179c280a6adab5c9c6"`);
    await queryRunner.query(`DROP TABLE "knowledge_items"`);
  }
}
