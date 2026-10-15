import { z } from "zod";

export const keySchema = z
  .string()
  .min(2)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
