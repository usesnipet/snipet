import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorAgentRun1794579256360 implements MigrationInterface {
  name = "RefactorAgentRun1794579256360";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c135aeeeff2d6504aba262cda9"`);
    await queryRunner.query(`ALTER TABLE "llm_connections" DROP COLUMN "default"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP COLUMN "extraOptions"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" ALTER COLUMN "connectionId" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "agent_llms" ADD CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a" FOREIGN KEY ("connectionId") REFERENCES "llm_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" ALTER COLUMN "connectionId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "agent_llms" ADD "extraOptions" json`);
    await queryRunner.query(`ALTER TABLE "llm_connections" ADD "default" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c135aeeeff2d6504aba262cda9" ON "llm_connections" USING btree ("llmKey") WHERE "default"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_llms" ADD CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a" FOREIGN KEY ("connectionId") REFERENCES "llm_connections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
