import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApps1791227972046 implements MigrationInterface {
  name = "AddApps1791227972046";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_c698bc0cd1f41a9c0da7dabb35b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c698bc0cd1f41a9c0da7dabb35"`);
    await queryRunner.query(
      `CREATE TABLE "apps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "allowedOrigins" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_c5121fda0f8268f1f7f84134e19" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP COLUMN "apiKeyId"`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD "appId" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" ADD "appId" uuid`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" ADD "externalUserId" character varying(255)`);
    await queryRunner.query(`CREATE INDEX "IDX_e49f20f20792c468014bfafd7f" ON "api_keys"  ("appId") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_eaf899f6b701477b883c60a022" ON "agent_sessions"  ("appId", "externalUserId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "CHK_agent_sessions_external_user" CHECK ("externalUserId" IS NULL OR "appId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "CHK_agent_sessions_owner" CHECK (("userId" IS NULL) <> ("appId" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "FK_e49f20f20792c468014bfafd7f4" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_5f37732c0d80992cb3b467c8b3e" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_5f37732c0d80992cb3b467c8b3e"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_e49f20f20792c468014bfafd7f4"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "CHK_agent_sessions_owner"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "CHK_agent_sessions_external_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_eaf899f6b701477b883c60a022"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e49f20f20792c468014bfafd7f"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP COLUMN "externalUserId"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP COLUMN "appId"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "appId"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" ADD "apiKeyId" uuid`);
    await queryRunner.query(`DROP TABLE "apps"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_c698bc0cd1f41a9c0da7dabb35" ON "agent_sessions" USING btree ("apiKeyId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_c698bc0cd1f41a9c0da7dabb35b" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
