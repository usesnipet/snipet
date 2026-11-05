import { MigrationInterface, QueryRunner } from "typeorm";

/** The hooks of the loop when hooks became a plugin capability. */
const HOOK_NAMES = [
  "run.start",
  "run.context",
  "llm.request",
  "llm.response",
  "tool.before",
  "tool.after",
  "tool.error",
  "run.end",
];

/**
 * Hook connections become plugin connections (same id, config copied sealed),
 * and each agent's hooks become an entry in its plugin list after its other
 * plugins, with the hooks it didn't bind disabled. The run.* status hooks map
 * to run.end. Global hooks (no agent) are dropped: there are no global plugins.
 */
export class HooksIntoPlugins1793300000000 implements MigrationInterface {
  name = "HooksIntoPlugins1793300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" ADD "position" integer NOT NULL DEFAULT '0'`);
    // No default: an empty value reads as {}, and SQL can't seal one.
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" ADD "settings" text`);
    await queryRunner.query(
      `ALTER TABLE "agent_plugin_connections" ADD "disabledHooks" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`
      UPDATE "agent_plugin_connections" p SET "position" = o.position
      FROM (
        SELECT id, row_number() OVER (PARTITION BY "agentId" ORDER BY "createdAt", id) - 1 AS position
        FROM "agent_plugin_connections"
      ) o
      WHERE p.id = o.id`);

    // Both config columns are sealed with the same key, so the text copies as is.
    await queryRunner.query(`
      INSERT INTO "plugin_connections" ("id", "createdAt", "updatedAt", "name", "description", "pluginKey", "config", "enabled")
      SELECT "id", "createdAt", "updatedAt", "name", "description", "hookKey", "config", "enabled" FROM "hook_connections"`);
    await queryRunner.query(
      `
      INSERT INTO "agent_plugin_connections" ("agentId", "pluginConnectionId", "position", "disabledHooks")
      SELECT
        h."agentId",
        h."hookConnectionId",
        COALESCE((SELECT MAX(p."position") + 1 FROM "agent_plugin_connections" p WHERE p."agentId" = h."agentId"), 0)
          + row_number() OVER (PARTITION BY h."agentId" ORDER BY MIN(h."createdAt")) - 1,
        ARRAY(
          SELECT unnest($1::text[])
          EXCEPT
          SELECT CASE WHEN e IN ('run.completed', 'run.failed', 'run.cancelled', 'run.maxTurns') THEN 'run.end' ELSE e END
          FROM unnest(array_agg(h."event")) e
        )
      FROM "agent_hooks" h
      WHERE h."agentId" IS NOT NULL AND h."enabled"
      GROUP BY h."agentId", h."hookConnectionId"`,
      [HOOK_NAMES],
    );

    await queryRunner.query(`DROP TABLE "agent_hooks"`);
    await queryRunner.query(`DROP TABLE "hook_connections"`);
  }

  /** Recreates the old tables empty: the moved data stays in the plugin tables. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "hook_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "hookKey" character varying(255) NOT NULL, "config" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d6b5dfc4acb3bd4ced9700c05a0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_752401e23334485e0574ed8732" ON "hook_connections"  ("hookKey") `);
    await queryRunner.query(
      `CREATE TABLE "agent_hooks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid, "hookConnectionId" uuid NOT NULL, "event" character varying(64) NOT NULL, "stage" integer NOT NULL DEFAULT '0', "position" integer NOT NULL DEFAULT '0', "match" jsonb, "timeoutMs" integer, "onError" character varying(16) NOT NULL DEFAULT 'continue', "async" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_84a5b044c0184363be87527be6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_f4b66211b1334493c76f6b559f" ON "agent_hooks"  ("agentId") `);
    await queryRunner.query(
      `ALTER TABLE "agent_hooks" ADD CONSTRAINT "FK_f4b66211b1334493c76f6b559f4" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_hooks" ADD CONSTRAINT "FK_ad181dae8753422f484813ffdf6" FOREIGN KEY ("hookConnectionId") REFERENCES "hook_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP COLUMN "disabledHooks"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP COLUMN "settings"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP COLUMN "position"`);
  }
}
