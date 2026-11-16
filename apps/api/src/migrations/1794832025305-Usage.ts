import { MigrationInterface, QueryRunner } from "typeorm";

export class Usage1794832025305 implements MigrationInterface {
  name = "Usage1794832025305";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "usage_records" ("id" SERIAL NOT NULL, "agentId" uuid NOT NULL, "sessionId" uuid NOT NULL, "runId" uuid NOT NULL, "userId" uuid, "appId" uuid, "externalUserId" character varying(255), "connectionId" uuid NOT NULL, "model" character varying(255) NOT NULL, "inputTokens" integer NOT NULL, "outputTokens" integer NOT NULL, "cachedInputTokens" integer NOT NULL DEFAULT '0', "inputPrice" numeric(12,6), "outputPrice" numeric(12,6), "cachedInputPrice" numeric(12,6), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e511cf9f7dc53851569f87467a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_usage_records_runId" ON "usage_records"  ("runId") `);
    await queryRunner.query(`CREATE INDEX "IDX_ecbe1c4744d05c7cc932202d06" ON "usage_records"  ("createdAt") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_7034db83d2cb214af9d5abc2f5" ON "usage_records"  ("agentId", "createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_7034db83d2cb214af9d5abc2f5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ecbe1c4744d05c7cc932202d06"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_usage_records_runId"`);
    await queryRunner.query(`DROP TABLE "usage_records"`);
  }
}
