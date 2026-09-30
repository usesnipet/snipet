import type { McpServer as McpServerContract, McpServerConfig, McpTransport } from "@snipet/shared";
import { Column, Entity } from "typeorm";

import { BaseEntity } from "../../common/crud/base.entity.js";
import { env } from "../../env.js";
import { open, seal } from "../../utils/secret-box.js";

import type { ValueTransformer } from "typeorm";

// http `headers` carry credentials (auth tokens), so they are stored sealed.
const sealHeaders: ValueTransformer = {
  to: (value?: Record<string, unknown> | null) =>
    value?.headers ? { ...value, headers: seal(JSON.stringify(value.headers), env.ENCRYPTION_KEY) } : value,
  from: (value?: Record<string, unknown> | null) =>
    value?.headers
      ? { ...value, headers: JSON.parse(open(value.headers as string, env.ENCRYPTION_KEY)) as unknown }
      : value,
};

@Entity("mcp_servers")
export class McpServer extends BaseEntity implements McpServerContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255 })
  transport: McpTransport;

  @Column({ type: "jsonb", transformer: sealHeaders })
  config: McpServerConfig;

  @Column({ type: "timestamptz", nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastSyncedError: string | null;
}
