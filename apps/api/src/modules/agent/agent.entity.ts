import type {
  Agent as AgentContract,
  AgentLlm as AgentLlmContract,
  AgentPluginConnection as AgentPluginConnectionContract,
} from "@snipet/shared";
import { BaseEntity } from "@snipet/server-common";
import { AfterLoad, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";

import { LlmConnection } from "../llm-connection/llm-connection.entity.js";
import { PluginConnection } from "../plugin-connection/plugin-connection.entity.js";

@Entity("agents")
export class Agent extends BaseEntity implements AgentContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Column({ type: "text", default: "" })
  systemPrompt: string;

  @Column({ type: "int", default: 20 })
  maxTurns: number;

  @Column({ default: true })
  enabled: boolean;

  @OneToMany(() => AgentLlm, (llm) => llm.agent, { eager: true, cascade: ["insert"] })
  llms: AgentLlm[];

  @OneToMany(() => AgentPluginConnection, (grant) => grant.agent, { eager: true, cascade: ["insert"] })
  pluginConnections: AgentPluginConnection[];

  // Eager relations come unordered.
  @AfterLoad()
  sortLlms() {
    this.llms?.sort((a, b) => a.order - b.order);
  }
}

@Entity("agent_llms")
export class AgentLlm implements AgentLlmContract {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  agentId: string;

  @ManyToOne(() => Agent, (agent) => agent.llms, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent?: Agent;

  @Column({ type: "int" })
  order: number;

  @Column({ length: 255 })
  model: string;

  // A deleted connection falls back to the provider's default one.
  @Column({ type: "uuid", nullable: true })
  connectionId: string | null;

  @ManyToOne(() => LlmConnection, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "connectionId" })
  connection?: LlmConnection | null;

  @Column({ type: "jsonb", nullable: true })
  extraOptions: Record<string, unknown> | null;
}

@Entity("agent_plugin_connections")
@Unique(["agentId", "pluginConnectionId"])
export class AgentPluginConnection extends BaseEntity implements AgentPluginConnectionContract {
  @Column({ type: "uuid" })
  agentId: string;

  @ManyToOne(() => Agent, (agent) => agent.pluginConnections, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent?: Agent;

  @Column({ type: "uuid" })
  pluginConnectionId: string;

  @ManyToOne(() => PluginConnection, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pluginConnectionId" })
  pluginConnection?: PluginConnection;

  @Column({ type: "text", array: true, default: [] })
  allow: string[];

  @Column({ type: "text", array: true, default: [] })
  deny: string[];
}
