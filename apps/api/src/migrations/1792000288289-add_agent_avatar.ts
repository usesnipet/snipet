import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentAvatar1792000288289 implements MigrationInterface {
  name = "AddAgentAvatar1792000288289";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" ADD "avatar" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "avatar"`);
  }
}
