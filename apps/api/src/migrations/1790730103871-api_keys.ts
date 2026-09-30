import { MigrationInterface, QueryRunner } from "typeorm";

export class ApiKeys1790730103871 implements MigrationInterface {
  name = "ApiKeys1790730103871";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "keyId" character varying NOT NULL, "hash" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_8c29253f53d643ca3ca4d7eb020" UNIQUE ("keyId"), CONSTRAINT "UQ_598a14447f592c12d1fe22ba918" UNIQUE ("hash"), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
