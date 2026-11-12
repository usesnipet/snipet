import z from "zod";

export const ownerSchema = z.union([
  z.object({ userId: z.string(), appId: z.null(), externalUserId: z.null(), name: z.string().nullable() }),
  z.object({ userId: z.null(), appId: z.string(), externalUserId: z.string().nullable(), name: z.string().nullable() }),
]);

export type Owner = z.infer<typeof ownerSchema>;
