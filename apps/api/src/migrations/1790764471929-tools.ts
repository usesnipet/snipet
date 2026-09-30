import { MigrationInterface, QueryRunner } from "typeorm";

export class Tools1790764471929 implements MigrationInterface {
  name = "Tools1790764471929";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tools" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL, "inputSchema" jsonb NOT NULL, "source" character varying(255) NOT NULL, "mcpServerId" uuid, CONSTRAINT "PK_e23d56734caad471277bad8bf85" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_00ff2d73bec69a74a740d70892" ON "tools"  ("mcpServerId") `);
    await queryRunner.query(
      `ALTER TABLE "tools" ADD CONSTRAINT "FK_00ff2d73bec69a74a740d708923" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tools" DROP CONSTRAINT "FK_00ff2d73bec69a74a740d708923"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_00ff2d73bec69a74a740d70892"`);
    await queryRunner.query(`DROP TABLE "tools"`);
  }
}
