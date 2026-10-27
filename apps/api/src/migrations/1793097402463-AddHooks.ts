import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHooks1793097402463 implements MigrationInterface {
  name = "AddHooks1793097402463";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "hook_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "hookKey" character varying(255) NOT NULL, "config" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d6b5dfc4acb3bd4ced9700c05a0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_752401e23334485e0574ed8732" ON "hook_connections"  ("hookKey") `);
    await queryRunner.query(
      `CREATE TABLE "agent_hooks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid, "hookConnectionId" uuid NOT NULL, "hooks" text array NOT NULL, "order" integer NOT NULL DEFAULT '0', "match" jsonb, "timeoutMs" integer, "onError" character varying(16) NOT NULL DEFAULT 'continue', "async" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_84a5b044c0184363be87527be6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_f4b66211b1334493c76f6b559f" ON "agent_hooks"  ("agentId") `);
    await queryRunner.query(
      `ALTER TABLE "agent_hooks" ADD CONSTRAINT "FK_f4b66211b1334493c76f6b559f4" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_hooks" ADD CONSTRAINT "FK_ad181dae8753422f484813ffdf6" FOREIGN KEY ("hookConnectionId") REFERENCES "hook_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_hooks" DROP CONSTRAINT "FK_ad181dae8753422f484813ffdf6"`);
    await queryRunner.query(`ALTER TABLE "agent_hooks" DROP CONSTRAINT "FK_f4b66211b1334493c76f6b559f4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f4b66211b1334493c76f6b559f"`);
    await queryRunner.query(`DROP TABLE "agent_hooks"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_752401e23334485e0574ed8732"`);
    await queryRunner.query(`DROP TABLE "hook_connections"`);
  }
}
