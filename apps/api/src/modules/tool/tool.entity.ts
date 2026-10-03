import type { Tool as ToolContract, ToolSource } from "@snipet/shared";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { BaseEntity } from "@snipet/server-common";
import { McpServer } from "../mcp-server/mcp-server.entity.js";

@Entity("tools")
export class Tool extends BaseEntity implements ToolContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "jsonb" })
  inputSchema: Record<string, unknown>;

  @Column({ type: "varchar", length: 255 })
  source: ToolSource;

  @Index()
  @Column({ type: "uuid", nullable: true })
  mcpServerId: string | null;

  @ManyToOne(() => McpServer, { onDelete: "CASCADE", eager: true, nullable: true })
  @JoinColumn({ name: "mcpServerId" })
  mcpServer: McpServer | null;
}
