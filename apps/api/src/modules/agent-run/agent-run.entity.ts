import type {
  AgentMessage as AgentMessageContract,
  AgentRun as AgentRunContract,
  AgentRunStatus,
  AgentSession as AgentSessionContract,
  LlmPart,
  LlmRole,
} from "@snipet/shared";
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { BaseEntity } from "@snipet/server-common";
import { Agent } from "../agent/agent.entity.js";
import { App } from "../app/app.entity.js";
import { User } from "../user/user.entity.js";

// Exactly one of userId / appId is set: whoever started the session.
// externalUserId is only set with appId.
@Entity("agent_sessions")
@Index(["appId", "externalUserId"])
@Check("CHK_agent_sessions_owner", `("userId" IS NULL) <> ("appId" IS NULL)`)
@Check("CHK_agent_sessions_external_user", `"externalUserId" IS NULL OR "appId" IS NOT NULL`)
export class AgentSession extends BaseEntity implements AgentSessionContract {
  @Index()
  @Column({ type: "uuid" })
  agentId: string;

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent?: Agent;

  @Index()
  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column({ type: "uuid", nullable: true })
  appId: string | null;

  @ManyToOne(() => App, { onDelete: "CASCADE" })
  @JoinColumn({ name: "appId" })
  app?: App;

  @Column({ type: "varchar", length: 255, nullable: true })
  externalUserId: string | null;

  @Column({ length: 255 })
  title: string;
}

@Entity("agent_runs")
// One running run per session at a time.
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

@Entity("agent_messages")
export class AgentMessage implements AgentMessageContract {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: "uuid" })
  sessionId: string;

  @ManyToOne(() => AgentSession, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sessionId" })
  session?: AgentSession;

  @Index()
  @Column({ type: "uuid" })
  runId: string;

  @ManyToOne(() => AgentRun, { onDelete: "CASCADE" })
  @JoinColumn({ name: "runId" })
  run?: AgentRun;

  @Column({ type: "varchar", length: 32 })
  role: LlmRole;

  @Column({ type: "jsonb" })
  parts: LlmPart[];

  @Column({ type: "varchar", length: 255, nullable: true })
  model: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
