import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1791986106790 implements MigrationInterface {
  name = "Initial1791986106790";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "apps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "allowedOrigins" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_c5121fda0f8268f1f7f84134e19" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "appId" uuid NOT NULL, "name" character varying(255) NOT NULL, "keyId" character varying NOT NULL, "hash" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_8c29253f53d643ca3ca4d7eb020" UNIQUE ("keyId"), CONSTRAINT "UQ_598a14447f592c12d1fe22ba918" UNIQUE ("hash"), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_e49f20f20792c468014bfafd7f" ON "api_keys"  ("appId") `);
    await queryRunner.query(
      `CREATE TABLE "knowledge_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "externalId" character varying(1024) NOT NULL, "name" text NOT NULL, "hash" character varying(128) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "kind" character varying(32), "status" character varying(20) NOT NULL DEFAULT 'pending', "reason" text, "lastError" text, "indexedAt" TIMESTAMP WITH TIME ZONE, "lastModified" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4da6043fefe372aa8151664e3b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c9cdd12a179c280a6adab5c9c6" ON "knowledge_items"  ("externalId") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_33968f7d84d12a425dc98168e0" ON "knowledge_items"  ("status") `);
    await queryRunner.query(
      `CREATE TABLE "llm_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "llmKey" character varying(255) NOT NULL, "config" text NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "default" boolean NOT NULL DEFAULT false, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "lastSyncedError" character varying(255), CONSTRAINT "PK_388f3e716b621f2e25c63700160" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c135aeeeff2d6504aba262cda9" ON "llm_connections"  ("llmKey") WHERE "default"`,
    );
    await queryRunner.query(
      `CREATE TABLE "llm_models" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "llmConnectionId" uuid NOT NULL, "key" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "capabilities" text array NOT NULL DEFAULT '{}', "contextWindow" integer NOT NULL DEFAULT '0', "maxOutputTokens" integer, CONSTRAINT "UQ_0444e4e0cdc89f55a3912b14702" UNIQUE ("llmConnectionId", "key"), CONSTRAINT "PK_315c88e45d5dec7ededa8b05507" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plugin_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "pluginKey" character varying(255) NOT NULL, "config" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "lastSyncedError" character varying(255), CONSTRAINT "PK_a12b591d9a618c3a245451b1275" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_193d4671a6961e881d6ce39044" ON "plugin_connections"  ("pluginKey") `);
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "systemPrompt" text NOT NULL DEFAULT '', "maxTurns" integer NOT NULL DEFAULT '20', "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_llms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentId" uuid NOT NULL, "order" integer NOT NULL, "model" character varying(255) NOT NULL, "connectionId" uuid, "extraOptions" json, CONSTRAINT "PK_b52750c52fd75daf8a53d039a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_plugin_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid NOT NULL, "pluginConnectionId" uuid NOT NULL, "allow" text array NOT NULL DEFAULT '{}', "deny" text array NOT NULL DEFAULT '{}', CONSTRAINT "UQ_3ddfbe3fe22a0241c93a1505a21" UNIQUE ("agentId", "pluginConnectionId"), CONSTRAINT "PK_e8a908ef06c4f67c0c6d8a324fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plugin_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "pluginConnectionId" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "inputSchema" jsonb NOT NULL, CONSTRAINT "UQ_5aac9a8f2fc1cb19b642490cba0" UNIQUE ("pluginConnectionId", "name"), CONSTRAINT "PK_e9fc536412fd136237107490364" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "username" character varying NOT NULL, "name" character varying NOT NULL, "password" character varying NOT NULL, "role" character varying(32) NOT NULL, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid NOT NULL, "userId" uuid, "appId" uuid, "externalUserId" character varying(255), "title" character varying(255) NOT NULL, CONSTRAINT "CHK_agent_sessions_external_user" CHECK ("externalUserId" IS NULL OR "appId" IS NOT NULL), CONSTRAINT "CHK_agent_sessions_owner" CHECK (("userId" IS NULL) <> ("appId" IS NULL)), CONSTRAINT "PK_56f9e856ca24a6064c903044605" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_28da58dd89f419aa0187b385c4" ON "agent_sessions"  ("agentId") `);
    await queryRunner.query(`CREATE INDEX "IDX_40a6b0600d60c067ae0f8659ce" ON "agent_sessions"  ("userId") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_eaf899f6b701477b883c60a022" ON "agent_sessions"  ("appId", "externalUserId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" uuid NOT NULL, "status" character varying(32) NOT NULL, "error" text, "turns" integer NOT NULL DEFAULT '0', "finishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_442f7e0ec4ae860cf17edc57825" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_f373888cc0d3848b3f2b536311" ON "agent_runs"  ("sessionId") `);
    await queryRunner.query(`CREATE INDEX "IDX_458e96b4b2cdead051497dcdcc" ON "agent_runs"  ("status") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cc711b0a099a864d0225ce87f6" ON "agent_runs"  ("sessionId") WHERE "status" = 'running'`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_messages" ("id" SERIAL NOT NULL, "sessionId" uuid NOT NULL, "runId" uuid NOT NULL, "role" character varying(32) NOT NULL, "parts" jsonb NOT NULL, "model" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8c7cdeda30e81dba421925df4fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_2f31beb174c2443c9b425ecc77" ON "agent_messages"  ("sessionId") `);
    await queryRunner.query(`CREATE INDEX "IDX_aa3b1a816dae56bfb4169617ac" ON "agent_messages"  ("runId") `);
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "hash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_2cf4b2a681a38f8044d688b9ccb" UNIQUE ("hash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `);
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "FK_e49f20f20792c468014bfafd7f4" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "llm_models" ADD CONSTRAINT "FK_656bdae7e02f085b9c1ce232953" FOREIGN KEY ("llmConnectionId") REFERENCES "llm_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_llms" ADD CONSTRAINT "FK_2b79dc5af62562353a70657ee62" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_llms" ADD CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a" FOREIGN KEY ("connectionId") REFERENCES "llm_connections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
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
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_28da58dd89f419aa0187b385c4c" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_40a6b0600d60c067ae0f8659ce0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_5f37732c0d80992cb3b467c8b3e" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD CONSTRAINT "FK_f373888cc0d3848b3f2b536311e" FOREIGN KEY ("sessionId") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD CONSTRAINT "FK_2f31beb174c2443c9b425ecc77f" FOREIGN KEY ("sessionId") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD CONSTRAINT "FK_aa3b1a816dae56bfb4169617acb" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP CONSTRAINT "FK_aa3b1a816dae56bfb4169617acb"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP CONSTRAINT "FK_2f31beb174c2443c9b425ecc77f"`);
    await queryRunner.query(`ALTER TABLE "agent_runs" DROP CONSTRAINT "FK_f373888cc0d3848b3f2b536311e"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_5f37732c0d80992cb3b467c8b3e"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_40a6b0600d60c067ae0f8659ce0"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_28da58dd89f419aa0187b385c4c"`);
    await queryRunner.query(`ALTER TABLE "plugin_actions" DROP CONSTRAINT "FK_7c4feee1672bd7f29686b14cc1d"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP CONSTRAINT "FK_48545aca8b7b087851533dfcceb"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP CONSTRAINT "FK_2b3e7a2e7bdadc2fde2394d837a"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP CONSTRAINT "FK_2b79dc5af62562353a70657ee62"`);
    await queryRunner.query(`ALTER TABLE "llm_models" DROP CONSTRAINT "FK_656bdae7e02f085b9c1ce232953"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_e49f20f20792c468014bfafd7f4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aa3b1a816dae56bfb4169617ac"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2f31beb174c2443c9b425ecc77"`);
    await queryRunner.query(`DROP TABLE "agent_messages"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cc711b0a099a864d0225ce87f6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_458e96b4b2cdead051497dcdcc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f373888cc0d3848b3f2b536311"`);
    await queryRunner.query(`DROP TABLE "agent_runs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_eaf899f6b701477b883c60a022"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_40a6b0600d60c067ae0f8659ce"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_28da58dd89f419aa0187b385c4"`);
    await queryRunner.query(`DROP TABLE "agent_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "plugin_actions"`);
    await queryRunner.query(`DROP TABLE "agent_plugin_connections"`);
    await queryRunner.query(`DROP TABLE "agent_llms"`);
    await queryRunner.query(`DROP TABLE "agents"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_193d4671a6961e881d6ce39044"`);
    await queryRunner.query(`DROP TABLE "plugin_connections"`);
    await queryRunner.query(`DROP TABLE "llm_models"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c135aeeeff2d6504aba262cda9"`);
    await queryRunner.query(`DROP TABLE "llm_connections"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_33968f7d84d12a425dc98168e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c9cdd12a179c280a6adab5c9c6"`);
    await queryRunner.query(`DROP TABLE "knowledge_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e49f20f20792c468014bfafd7f"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "apps"`);
  }
}
