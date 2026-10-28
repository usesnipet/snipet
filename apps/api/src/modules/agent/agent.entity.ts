import type {
  Agent as AgentContract,
  AgentLlm as AgentLlmContract,
  AgentHook as AgentHookContract,
  AgentPluginConnection as AgentPluginConnectionContract,
  HookName,
  HookMatch,
  HookOnError,
  JsonObject,
} from "@snipet/shared";
import { fromStorageUrl, toStorageUrl } from "#src/infra/storage/utils.js";
import { BaseEntity } from "@snipet/server-common";
import {
  AfterLoad,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  ValueTransformer,
} from "typeorm";

import { HookConnection } from "../hook-connection/hook-connection.entity.js";
import { LlmConnection } from "../llm-connection/llm-connection.entity.js";
import { PluginConnection } from "../plugin-connection/plugin-connection.entity.js";

/** Column holding a file path: reads as the public URL, writes back as the path. */
export const storagePathTransformer: ValueTransformer = {
  from: (path: string | null) => path && toStorageUrl(path),
  to: (url: string | null | undefined) => url && fromStorageUrl(url),
};

@Entity("agents")
export class Agent extends BaseEntity implements AgentContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", default: "" })
  description: string;

  /** Stored as the file's path, read as its public URL. */
  @Column({ type: "text", nullable: true, transformer: storagePathTransformer })
  avatar: string | null;

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

  /** Only the agent's own hooks; global ones (agentId null) aren't listed here. */
  @OneToMany(() => AgentHook, (hook) => hook.agent, { eager: true, cascade: ["insert"] })
  hooks: AgentHook[];

  /** Puts llms in the order they run and hooks by position; eager relations load unordered. */
  @AfterLoad()
  sortByOrder() {
    this.llms?.sort((a, b) => a.order - b.order);
    this.hooks?.sort((a, b) => a.position - b.position);
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

  /** A deleted connection falls back to the llm's default one. */
  @Column({ type: "uuid", nullable: true })
  connectionId: string | null;

  @ManyToOne(() => LlmConnection, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "connectionId" })
  connection?: LlmConnection | null;

  @Column({ type: "json", nullable: true })
  extraOptions: JsonObject | null;
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

@Entity("agent_hooks")
export class AgentHook extends BaseEntity implements AgentHookContract {
  /** null: applies to every agent. */
  @Index()
  @Column({ type: "uuid", nullable: true })
  agentId: string | null;

  @ManyToOne(() => Agent, (agent) => agent.hooks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent?: Agent;

  @Column({ type: "uuid" })
  hookConnectionId: string;

  @ManyToOne(() => HookConnection, { onDelete: "CASCADE" })
  @JoinColumn({ name: "hookConnectionId" })
  hookConnection?: HookConnection;

  @Column({ type: "varchar", length: 64 })
  event: HookName;

  @Column({ type: "int", default: 0 })
  stage: number;

  @Column({ type: "int", default: 0 })
  position: number;

  @Column({ type: "jsonb", nullable: true })
  match: HookMatch | null;

  @Column({ type: "int", nullable: true })
  timeoutMs: number | null;

  @Column({ type: "varchar", length: 16, default: "continue" })
  onError: HookOnError;

  @Column({ default: false })
  async: boolean;

  @Column({ default: true })
  enabled: boolean;
}
