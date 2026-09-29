import { Column, Entity } from "typeorm";

import { BaseEntity } from "../../common/crud/base.entity";

@Entity("widgets")
export class Widget extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: "jsonb", default: {} })
  spec: Record<string, unknown>;
}
