import type {
  Agent as AgentContract,
  AgentLlm as AgentLlmContract,
  AgentPluginConnection as AgentPluginConnectionContract,
  HookName,
  JsonObject,
} from "@snipet/shared";
import { sealConfig } from "#src/infra/database/seal-config.js";
import { fromStorageUrl, toStorageUrl } from "#src/infra/storage/utils.js";
import { BaseEntity } from "@snipet/server-common";
import {
  AfterLoad,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  ValueTransformer,
} from "typeorm";

import { LlmConnection } from "../llm-connection/llm-connection.entity.js";
import { PluginConnection } from "../plugin-connection/plugin-connection.entity.js";

/** Column holding a file path: reads as the public URL, writes back as the path. */
export const storagePathTransformer: ValueTransformer = {
  from: (path: string | null) => path && toStorageUrl(path),
  to: (url: string | null | undefined) => url && fromStorageUrl(url),
};

/**
 * sealConfig, reading a missing value (rows added by SQL, which can't seal)
 * as no settings.
 */
const sealSettings: ValueTransformer = {
  to: (value?: JsonObject | null) => sealConfig.to(value ?? {}) as string,
  from: (value?: string | null) => (value ? (sealConfig.from(value) as JsonObject) : {}),
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

  /** How many of the session's previous runs the models see, besides the current one. */
  @Column({ type: "int", default: 10 })
  historyRuns: number;

  @Column({ default: true })
  enabled: boolean;

  @OneToMany(() => AgentLlm, (llm) => llm.agent, { eager: true, cascade: ["insert"] })
  llms: AgentLlm[];

  @OneToMany(() => AgentPluginConnection, (grant) => grant.agent, { eager: true, cascade: ["insert"] })
  pluginConnections: AgentPluginConnection[];

  /** Puts llms in the order they run and plugins by position; eager relations load unordered. */
  @AfterLoad()
  sortByOrder() {
    this.llms?.sort((a, b) => a.order - b.order);
    this.pluginConnections?.sort((a, b) => a.position - b.position);
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

  /** The llm manifest's key, e.g. "openai". */
  @Column({ length: 255 })
  llm: string;

  /** The model's key within the llm; it may itself contain "/". */
  @Column({ length: 255 })
  model: string;

  /** Deleting the connection removes this LLM from the agent. */
  @Column({ type: "uuid" })
  connectionId: string;

  @ManyToOne(() => LlmConnection, { onDelete: "CASCADE" })
  @JoinColumn({ name: "connectionId" })
  connection?: LlmConnection;
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

  /** Names of the tools the agent can call; a tool added by a later sync stays off until selected. */
  @Column({ type: "text", array: true, default: [] })
  tools: string[];

  @Column({ type: "int", default: 0 })
  position: number;

  /** Sealed whole, like connection configs: settings may hold secrets. */
  @Column({ type: "text", nullable: true, transformer: sealSettings })
  settings: JsonObject;

  @Column({ type: "text", array: true, default: [] })
  disabledHooks: HookName[];
}
