import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppAllowAnonymous1792300000000 implements MigrationInterface {
  name = "AddAppAllowAnonymous1792300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "apps" ADD "allowAnonymous" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "apps" DROP COLUMN "allowAnonymous"`);
  }
}
