import { BaseEntity } from "@snipet/server-common";
import { Column, Entity } from "typeorm";

// One row per setting; the shape of each value is set by settingsSchema.
@Entity("settings")
export class Setting extends BaseEntity {
  @Column({ length: 255, unique: true })
  key: string;

  @Column({ type: "jsonb" })
  value: unknown;
}
