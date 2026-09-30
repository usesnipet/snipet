import { MigrationInterface, QueryRunner } from "typeorm";

export class McpServers1790762744042 implements MigrationInterface {
  name = "McpServers1790762744042";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "mcp_servers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "transport" character varying(255) NOT NULL, "config" jsonb NOT NULL, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "lastSyncedError" character varying(255), CONSTRAINT "PK_c781b3dc7cb2a5d19460b71914d" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mcp_servers"`);
  }
}
