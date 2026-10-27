import { MigrationInterface, QueryRunner } from "typeorm";

/** Debugging moved to the `debug` hook. */
export class DropAgentRunDebugged1793100000000 implements MigrationInterface {
  name = "DropAgentRunDebugged1793100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_runs" DROP COLUMN "debugged"`);
    await queryRunner.query(`DELETE FROM "settings" WHERE "key" = 'agentDebugEnabled'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_runs" ADD "debugged" boolean NOT NULL DEFAULT false`);
  }
}
