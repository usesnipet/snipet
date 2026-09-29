import { z } from "zod";

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
