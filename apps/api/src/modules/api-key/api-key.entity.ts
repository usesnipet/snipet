import type { ApiKey as ApiKeyContract } from "@snipet/shared";
import { BaseEntity } from "@snipet/server-common";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { App } from "../app/app.entity.js";

@Entity("api_keys")
export class ApiKey extends BaseEntity implements ApiKeyContract {
  @Index()
  @Column({ type: "uuid" })
  appId: string;

  @ManyToOne(() => App, { onDelete: "CASCADE" })
  @JoinColumn({ name: "appId" })
  app?: App;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true })
  keyId: string;

  // SHA-256 of the key. select: false keeps it out of every query unless asked for.
  @Column({ unique: true, select: false })
  hash?: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt: Date | null;
}
