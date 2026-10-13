import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";

import { PluginConnection } from "./plugin-connection.entity.js";

@Entity("plugin_actions")
@Unique(["pluginConnectionId", "name"])
export class PluginAction extends BaseEntity {
  @Column({ type: "uuid" })
  pluginConnectionId: string;

  @ManyToOne(() => PluginConnection, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pluginConnectionId" })
  pluginConnection?: PluginConnection;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "jsonb" })
  inputSchema: Record<string, unknown>;
}
