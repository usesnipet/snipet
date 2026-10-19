import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSettings1792105231544 implements MigrationInterface {
  name = "AddSettings1792105231544";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "key" character varying(255) NOT NULL, "value" jsonb NOT NULL, CONSTRAINT "UQ_c8639b7626fa94ba8265628f214" UNIQUE ("key"), CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "settings"`);
  }
}
