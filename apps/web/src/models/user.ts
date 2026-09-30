import { z } from "zod";

export const roleSchema = z.enum(["admin", "user"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    role: roleSchema,
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();
export type User = z.infer<typeof userSchema>;
