import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

export enum Role {
  User = "user",
  Admin = "admin",
}

export const roleSchema = z.enum(Role);

// Never carries the password hash.
export const userSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  name: z.string(),
  role: roleSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const paginatedUserSchema = paginatedSchema(userSchema);

export const createUserSchema = z.object({
  username: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  password: z.string().min(8).max(255),
  role: roleSchema,
});
export type CreateUser = z.infer<typeof createUserSchema>;

// Username is the login handle and never changes.
export const updateUserSchema = createUserSchema.omit({ username: true }).partial();
export type UpdateUser = z.infer<typeof updateUserSchema>;

export const findUsersParamsSchema = paginationParamsSchema.extend({
  username: z.string().optional(),
});
export type FindUsersParams = z.infer<typeof findUsersParamsSchema>;
