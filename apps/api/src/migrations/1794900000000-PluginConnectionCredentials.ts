import { MigrationInterface, QueryRunner } from "typeorm";

export class PluginConnectionCredentials1794900000000 implements MigrationInterface {
  name = "PluginConnectionCredentials1794900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_connections" ADD "credentials" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_connections" DROP COLUMN "credentials"`);
  }
}
