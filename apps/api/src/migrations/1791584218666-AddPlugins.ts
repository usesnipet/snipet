import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlugins1791584218666 implements MigrationInterface {
  name = "AddPlugins1791584218666";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "plugin_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "pluginKey" character varying(255) NOT NULL, "config" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "lastSyncedError" character varying(255), CONSTRAINT "PK_a12b591d9a618c3a245451b1275" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_193d4671a6961e881d6ce39044" ON "plugin_connections"  ("pluginKey") `);
    await queryRunner.query(
      `CREATE TABLE "agent_plugin_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid NOT NULL, "pluginConnectionId" uuid NOT NULL, "allow" text array NOT NULL DEFAULT '{}', "deny" text array NOT NULL DEFAULT '{}', CONSTRAINT "UQ_3ddfbe3fe22a0241c93a1505a21" UNIQUE ("agentId", "pluginConnectionId"), CONSTRAINT "PK_e8a908ef06c4f67c0c6d8a324fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plugin_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "pluginConnectionId" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "inputSchema" jsonb NOT NULL, CONSTRAINT "UQ_5aac9a8f2fc1cb19b642490cba0" UNIQUE ("pluginConnectionId", "name"), CONSTRAINT "PK_e9fc536412fd136237107490364" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_plugin_connections" ADD CONSTRAINT "FK_2b3e7a2e7bdadc2fde2394d837a" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_plugin_connections" ADD CONSTRAINT "FK_48545aca8b7b087851533dfcceb" FOREIGN KEY ("pluginConnectionId") REFERENCES "plugin_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plugin_actions" ADD CONSTRAINT "FK_7c4feee1672bd7f29686b14cc1d" FOREIGN KEY ("pluginConnectionId") REFERENCES "plugin_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_actions" DROP CONSTRAINT "FK_7c4feee1672bd7f29686b14cc1d"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP CONSTRAINT "FK_48545aca8b7b087851533dfcceb"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP CONSTRAINT "FK_2b3e7a2e7bdadc2fde2394d837a"`);
    await queryRunner.query(`DROP TABLE "plugin_actions"`);
    await queryRunner.query(`DROP TABLE "agent_plugin_connections"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_193d4671a6961e881d6ce39044"`);
    await queryRunner.query(`DROP TABLE "plugin_connections"`);
  }
}
