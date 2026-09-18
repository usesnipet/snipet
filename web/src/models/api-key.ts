import { z } from "zod";

export const apiKeyKeySchema = z.string().length(46).startsWith("sn_");
export type ApiKeyKey = z.infer<typeof apiKeyKeySchema>;

const optionalDateSchema = z
  .union([z.coerce.date(), z.null()])
  .optional()
  .transform((value) => value ?? undefined);

export interface ApiKey {
  id: string;
  name: string;
  key_id: string;
  active: boolean;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/** Own fields only, no relations — pick/extend/partial from this in feature schemas (create/update DTOs). */
export const apiKeyBaseSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(255),
    key_id: z.string(),
    active: z.boolean(),
    expires_at: optionalDateSchema,
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();

export const apiKeySchema: z.ZodType<ApiKey> = apiKeyBaseSchema;
