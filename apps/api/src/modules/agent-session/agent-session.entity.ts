import type { AgentSession as AgentSessionContract } from "@snipet/shared";
import { BaseEntity } from "@snipet/server-common";
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { Agent } from "../agent/agent.entity.js";
import { App } from "../app/app.entity.js";
import { User } from "../user/user.entity.js";

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
