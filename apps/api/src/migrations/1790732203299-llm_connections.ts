import { MigrationInterface, QueryRunner } from "typeorm";

export class LlmConnections1790732203299 implements MigrationInterface {
  name = "LlmConnections1790732203299";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "llm_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "provider" character varying(255) NOT NULL, "config" jsonb NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_388f3e716b621f2e25c63700160" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c6019378fe78aa4496d71ebf75" ON "llm_connections"  ("provider") WHERE "default"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_c6019378fe78aa4496d71ebf75"`);
    await queryRunner.query(`DROP TABLE "llm_connections"`);
  }
}
