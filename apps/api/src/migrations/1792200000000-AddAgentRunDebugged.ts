import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentRunDebugged1792200000000 implements MigrationInterface {
  name = "AddAgentRunDebugged1792200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_runs" ADD "debugged" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_runs" DROP COLUMN "debugged"`);
  }
}
