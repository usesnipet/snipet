import { MigrationInterface, QueryRunner } from "typeorm";

/** Constraint names TypeORM derives from the table name, old and new. */
const CONSTRAINTS = [
  ["PK_e9fc536412fd136237107490364", "PK_8ef23c125ae7581637e35a183c4"],
  ["UQ_5aac9a8f2fc1cb19b642490cba0", "UQ_95efce92445bab89576ae899c34"],
  ["FK_7c4feee1672bd7f29686b14cc1d", "FK_d38de6c9231517c072cb976493b"],
];

/**
 * Plugin actions become plugin tools. The constraints are renamed too, so a
 * later migration:generate doesn't see them as changed.
 */
export class RenamePluginActionsToTools1793400000000 implements MigrationInterface {
  name = "RenamePluginActionsToTools1793400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_actions" RENAME TO "plugin_tools"`);
    for (const [from, to] of CONSTRAINTS) {
      await queryRunner.query(`ALTER TABLE "plugin_tools" RENAME CONSTRAINT "${from}" TO "${to}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of CONSTRAINTS) {
      await queryRunner.query(`ALTER TABLE "plugin_tools" RENAME CONSTRAINT "${to}" TO "${from}"`);
    }
    await queryRunner.query(`ALTER TABLE "plugin_tools" RENAME TO "plugin_actions"`);
  }
}
