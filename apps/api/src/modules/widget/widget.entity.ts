import type { Widget as WidgetContract } from "@snipet/contracts";
import { Column, Entity } from "typeorm";

import { BaseEntity } from "../../common/crud/base.entity.js";

@Entity("widgets")
export class Widget extends BaseEntity implements WidgetContract {
  @Column({ unique: true })
  name: string;

  @Column({ type: "jsonb", default: {} })
  spec: Record<string, unknown>;
}
