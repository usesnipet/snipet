import type { HookConnection as HookConnectionContract, JsonObject } from "@snipet/shared";
import { sealConfig } from "#src/manifest/seal-config.js";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, Index } from "typeorm";

@Entity("hook_connections")
export class HookConnection extends BaseEntity implements HookConnectionContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Index()
  @Column({ length: 255 })
  hookKey: string;

  @Column({ type: "text", transformer: sealConfig })
  config: JsonObject;

  @Column({ default: true })
  enabled: boolean;
}
