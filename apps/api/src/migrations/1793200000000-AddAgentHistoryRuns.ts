import { MigrationInterface, QueryRunner } from "typeorm";

/** The run history the models see is counted in runs per agent, not a fixed 20 messages. */
export class AddAgentHistoryRuns1793200000000 implements MigrationInterface {
  name = "AddAgentHistoryRuns1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" ADD "historyRuns" integer NOT NULL DEFAULT 10`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "historyRuns"`);
  }
}
