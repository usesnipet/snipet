import { MigrationInterface, QueryRunner } from "typeorm";

/** The removed isGranted glob: only "*" is special. Frozen here so the migration keeps its meaning. */
const matches = (glob: string, name: string) =>
  new RegExp(
    `^${glob
      .split("*")
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  ).test(name);

/**
 * A grant's allow/deny globs become the explicit list of tool names, expanded
 * against each connection's synced tools so agents keep the access they have.
 */
export class AgentPluginToolList1793600000000 implements MigrationInterface {
  name = "AgentPluginToolList1793600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" ADD "tools" text array NOT NULL DEFAULT '{}'`);

    const grants = (await queryRunner.query(
      `SELECT g."id", g."allow", g."deny", c."tools" AS "available"
       FROM "agent_plugin_connections" g
       JOIN "plugin_connections" c ON c."id" = g."pluginConnectionId"`,
    )) as { id: string; allow: string[]; deny: string[]; available: { name: string }[] }[];

    for (const { id, allow, deny, available } of grants) {
      const tools = available
        .map((t) => t.name)
        .filter((name) => !allow.length || allow.some((glob) => matches(glob, name)))
        .filter((name) => !deny.some((glob) => matches(glob, name)));
      await queryRunner.query(`UPDATE "agent_plugin_connections" SET "tools" = $1 WHERE "id" = $2`, [tools, id]);
    }

    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP COLUMN "allow"`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP COLUMN "deny"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" ADD "allow" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" ADD "deny" text array NOT NULL DEFAULT '{}'`);
    // An empty allow means every tool, so a grant with none selected must deny them all.
    await queryRunner.query(
      `UPDATE "agent_plugin_connections" SET "allow" = "tools", "deny" = CASE WHEN "tools" = '{}' THEN '{*}'::text[] ELSE '{}'::text[] END`,
    );
    await queryRunner.query(`ALTER TABLE "agent_plugin_connections" DROP COLUMN "tools"`);
  }
}
