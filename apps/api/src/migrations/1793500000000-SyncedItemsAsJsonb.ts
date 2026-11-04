import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Plugin tools and llm models become jsonb columns of their connection. The
 * rows aren't moved: the sync on boot fills the columns in again.
 */
export class SyncedItemsAsJsonb1793500000000 implements MigrationInterface {
  name = "SyncedItemsAsJsonb1793500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_connections" ADD "tools" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "llm_connections" ADD "models" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`DROP TABLE "plugin_tools"`);
    await queryRunner.query(`DROP TABLE "llm_models"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "llm_models" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "llmConnectionId" uuid NOT NULL, "key" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "capabilities" text array NOT NULL DEFAULT '{}', "contextWindow" integer NOT NULL DEFAULT '0', "maxOutputTokens" integer, CONSTRAINT "UQ_0444e4e0cdc89f55a3912b14702" UNIQUE ("llmConnectionId", "key"), CONSTRAINT "PK_315c88e45d5dec7ededa8b05507" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plugin_tools" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "pluginConnectionId" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "inputSchema" jsonb NOT NULL, CONSTRAINT "UQ_95efce92445bab89576ae899c34" UNIQUE ("pluginConnectionId", "name"), CONSTRAINT "PK_8ef23c125ae7581637e35a183c4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "llm_models" ADD CONSTRAINT "FK_656bdae7e02f085b9c1ce232953" FOREIGN KEY ("llmConnectionId") REFERENCES "llm_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plugin_tools" ADD CONSTRAINT "FK_d38de6c9231517c072cb976493b" FOREIGN KEY ("pluginConnectionId") REFERENCES "plugin_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "llm_connections" DROP COLUMN "models"`);
    await queryRunner.query(`ALTER TABLE "plugin_connections" DROP COLUMN "tools"`);
  }
}
