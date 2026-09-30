import { findUsersParamsSchema } from "@snipet/shared";
import { ILike } from "typeorm";

export { createUserSchema, updateUserSchema } from "@snipet/shared";

export const findUsersSchema = findUsersParamsSchema.transform(({ username, ...page }) => ({
  ...page,
  where: username ? { username: ILike(`%${username}%`) } : undefined,
  order: { createdAt: "DESC" as const },
}));
