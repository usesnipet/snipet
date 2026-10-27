import type { AgentHook as AgentHookContract, HookMatch, HookName } from "@snipet/shared";
import { Agent } from "#src/modules/agent/agent.entity.js";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { HookConnection } from "./hook-connection.entity.js";

@Entity("agent_hooks")
export class AgentHook extends BaseEntity implements AgentHookContract {
  /** null: applies to every agent. */
  @Index()
  @Column({ type: "uuid", nullable: true })
  agentId: string | null;

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent?: Agent;

  @Column({ type: "uuid" })
  hookConnectionId: string;

  @ManyToOne(() => HookConnection, { onDelete: "CASCADE" })
  @JoinColumn({ name: "hookConnectionId" })
  hookConnection?: HookConnection;

  @Column({ type: "text", array: true })
  hooks: HookName[];

  @Column({ type: "int", default: 0 })
  order: number;

  @Column({ type: "jsonb", nullable: true })
  match: HookMatch | null;

  @Column({ type: "int", nullable: true })
  timeoutMs: number | null;

  @Column({ type: "varchar", length: 16, default: "continue" })
  onError: "continue" | "fail";

  @Column({ default: false })
  async: boolean;

  @Column({ default: true })
  enabled: boolean;
}
