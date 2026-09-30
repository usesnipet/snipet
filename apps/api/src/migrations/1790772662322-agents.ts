import { MigrationInterface, QueryRunner } from "typeorm";

export class Agents1790772662322 implements MigrationInterface {
  name = "Agents1790772662322";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "systemPrompt" text NOT NULL DEFAULT '', "maxTurns" integer NOT NULL DEFAULT '20', "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_llms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentId" uuid NOT NULL, "order" integer NOT NULL, "model" character varying(255) NOT NULL, "connectionId" uuid, "extraOptions" jsonb, CONSTRAINT "PK_b52750c52fd75daf8a53d039a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_mcp_servers" ("agentId" uuid NOT NULL, "mcpServerId" uuid NOT NULL, "allow" text array NOT NULL DEFAULT '{}', "deny" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_b2a3ebf9f5320b51aef13f39d2c" PRIMARY KEY ("agentId", "mcpServerId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_llms" ADD CONSTRAINT "FK_2b79dc5af62562353a70657ee62" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_llms" ADD CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a" FOREIGN KEY ("connectionId") REFERENCES "llm_connections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_mcp_servers" ADD CONSTRAINT "FK_9b855a2d714731cfba647c5234f" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_mcp_servers" ADD CONSTRAINT "FK_36bee745ef7432d9fdddd32c710" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_mcp_servers" DROP CONSTRAINT "FK_36bee745ef7432d9fdddd32c710"`);
    await queryRunner.query(`ALTER TABLE "agent_mcp_servers" DROP CONSTRAINT "FK_9b855a2d714731cfba647c5234f"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP CONSTRAINT "FK_21ca60c0deb8528d74837eaf70a"`);
    await queryRunner.query(`ALTER TABLE "agent_llms" DROP CONSTRAINT "FK_2b79dc5af62562353a70657ee62"`);
    await queryRunner.query(`DROP TABLE "agent_mcp_servers"`);
    await queryRunner.query(`DROP TABLE "agent_llms"`);
    await queryRunner.query(`DROP TABLE "agents"`);
  }
}
