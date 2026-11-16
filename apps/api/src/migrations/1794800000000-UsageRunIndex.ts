import { MigrationInterface, QueryRunner } from "typeorm";

export class UsageRunIndex1794800000000 implements MigrationInterface {
  name = "UsageRunIndex1794800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_usage_records_runId" ON "usage_records" ("runId") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_usage_records_runId"`);
  }
}
