import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";

import { roleSchema, userSchema } from "@/models/user";

export { roleSchema, userSchema } from "@/models/user";
export type { Role, User } from "@/models/user";

export const createUserSchema = z
  .object({
    username: z.string().min(1, "Username is required").max(255),
    name: z.string().min(1, "Name is required").max(255),
    password: z
      .string()
      .min(8, "Must be at least 8 characters")
      .max(255),
    role: roleSchema,
  })
  .strict();
export type CreateUser = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .omit({ username: true })
  .partial()
  .strict();
export type UpdateUser = z.infer<typeof updateUserSchema>;

export const paginatedUserSchema = paginatedSchema(userSchema);
export type PaginatedUser = z.infer<typeof paginatedUserSchema>;

export const listUsersSearchParamsSchema = paginationParamsSchema;
export type ListUsersSearchParams = z.infer<typeof listUsersSearchParamsSchema>;
