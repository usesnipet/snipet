import type {
  Agent as AgentContract,
  AgentLlm as AgentLlmContract,
  AgentMcpServer as AgentMcpServerContract,
} from "@snipet/shared";
import {
  AfterLoad,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from "typeorm";

import { BaseEntity } from "@snipet/server-common";
import { LlmConnection } from "../llm-connection/llm-connection.entity.js";
import { McpServer } from "../mcp-server/mcp-server.entity.js";

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

  @OneToMany(() => AgentMcpServer, (grant) => grant.agent, { eager: true, cascade: ["insert"] })
  mcpServers: AgentMcpServer[];

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

@Entity("agent_mcp_servers")
export class AgentMcpServer implements AgentMcpServerContract {
  @PrimaryColumn({ type: "uuid" })
  agentId: string;

  @ManyToOne(() => Agent, (agent) => agent.mcpServers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent?: Agent;

  @PrimaryColumn({ type: "uuid" })
  mcpServerId: string;

  @ManyToOne(() => McpServer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mcpServerId" })
  mcpServer?: McpServer;

  @Column({ type: "text", array: true, default: [] })
  allow: string[];

  @Column({ type: "text", array: true, default: [] })
  deny: string[];
}
