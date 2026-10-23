import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPluginConnectionInstructions1792500000000 implements MigrationInterface {
  name = "AddPluginConnectionInstructions1792500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_connections" ADD "instructions" text`);
    await queryRunner.query(`ALTER TABLE "plugin_connections" ADD "customInstructions" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_connections" DROP COLUMN "customInstructions"`);
    await queryRunner.query(`ALTER TABLE "plugin_connections" DROP COLUMN "instructions"`);
  }
}
