import type { LLMMessagePart, LLMRole } from "@snipet/shared/core";
import type { AgentMessage as AgentMessageContract } from "@snipet/shared";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { AgentRun } from "../agent-run/agent-run.entity.js";

import { AgentSession } from "./agent-session.entity.js";

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
  role: LLMRole;

  @Column({ type: "jsonb" })
  parts: LLMMessagePart[];

  @Column({ type: "varchar", length: 255, nullable: true })
  model: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
