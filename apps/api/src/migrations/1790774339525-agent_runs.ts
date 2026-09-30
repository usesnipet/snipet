import { MigrationInterface, QueryRunner } from "typeorm";

export class AgentRuns1790774339525 implements MigrationInterface {
  name = "AgentRuns1790774339525";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid NOT NULL, "userId" uuid, "apiKeyId" uuid, "title" character varying(255) NOT NULL, CONSTRAINT "PK_56f9e856ca24a6064c903044605" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_28da58dd89f419aa0187b385c4" ON "agent_sessions"  ("agentId") `);
    await queryRunner.query(`CREATE INDEX "IDX_40a6b0600d60c067ae0f8659ce" ON "agent_sessions"  ("userId") `);
    await queryRunner.query(`CREATE INDEX "IDX_c698bc0cd1f41a9c0da7dabb35" ON "agent_sessions"  ("apiKeyId") `);
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
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_28da58dd89f419aa0187b385c4c" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_40a6b0600d60c067ae0f8659ce0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD CONSTRAINT "FK_c698bc0cd1f41a9c0da7dabb35b" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP CONSTRAINT "FK_aa3b1a816dae56bfb4169617acb"`);
    await queryRunner.query(`ALTER TABLE "agent_messages" DROP CONSTRAINT "FK_2f31beb174c2443c9b425ecc77f"`);
    await queryRunner.query(`ALTER TABLE "agent_runs" DROP CONSTRAINT "FK_f373888cc0d3848b3f2b536311e"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_c698bc0cd1f41a9c0da7dabb35b"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_40a6b0600d60c067ae0f8659ce0"`);
    await queryRunner.query(`ALTER TABLE "agent_sessions" DROP CONSTRAINT "FK_28da58dd89f419aa0187b385c4c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aa3b1a816dae56bfb4169617ac"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2f31beb174c2443c9b425ecc77"`);
    await queryRunner.query(`DROP TABLE "agent_messages"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cc711b0a099a864d0225ce87f6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_458e96b4b2cdead051497dcdcc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f373888cc0d3848b3f2b536311"`);
    await queryRunner.query(`DROP TABLE "agent_runs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c698bc0cd1f41a9c0da7dabb35"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_40a6b0600d60c067ae0f8659ce"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_28da58dd89f419aa0187b385c4"`);
    await queryRunner.query(`DROP TABLE "agent_sessions"`);
  }
}
