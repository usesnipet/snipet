import type { App as AppContract } from "@snipet/shared";
import { Column, Entity } from "typeorm";

import { BaseEntity } from "@snipet/server-common";

@Entity("apps")
export class App extends BaseEntity implements AppContract {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", array: true, default: [] })
  allowedOrigins: string[];
}
