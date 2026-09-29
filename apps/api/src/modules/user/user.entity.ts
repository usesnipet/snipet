import type { Role, User as UserContract } from "@snipet/shared";
import { Column, Entity } from "typeorm";

import { BaseEntity } from "../../common/crud/base.entity.js";

@Entity("users")
export class User extends BaseEntity implements UserContract {
  // Login handle, case-sensitive.
  @Column({ unique: true })
  username: string;

  @Column()
  name: string;

  // bcrypt hash. select: false keeps it out of every query unless asked for.
  @Column({ select: false })
  password: string;

  @Column({ type: "varchar", length: 32 })
  role: Role;
}
