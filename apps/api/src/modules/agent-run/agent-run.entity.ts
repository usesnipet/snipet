import type { AgentRunStatus } from "@snipet/shared";
import type { AgentRun as AgentRunContract } from "@snipet/shared";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { AgentSession } from "../agent-session/agent-session.entity.js";

@Entity("agent_runs")
@Index(["sessionId"], { unique: true, where: `"status" = 'running'` })
export class AgentRun extends BaseEntity implements AgentRunContract {
  @Index()
  @Column({ type: "uuid" })
  sessionId: string;

  @ManyToOne(() => AgentSession, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sessionId" })
  session?: AgentSession;

  @Index()
  @Column({ type: "varchar", length: 32 })
  status: AgentRunStatus;

  @Column({ type: "text", nullable: true })
  error: string | null;

  @Column({ type: "int", default: 0 })
  turns: number;

  @Column({ type: "timestamptz", nullable: true })
  finishedAt: Date | null;
}
