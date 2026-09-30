import { findKnowledgeItemsParamsSchema } from "@snipet/shared";
import { ILike } from "typeorm";

// Escapes LIKE wildcards so the search term matches literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export const findKnowledgeItemsSchema = findKnowledgeItemsParamsSchema.transform(
  ({ search, status, kind, ...page }) => ({
    ...page,
    where: {
      ...(search ? { name: ILike(`%${escapeLike(search)}%`) } : {}),
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
    },
    order: { externalId: "ASC" as const },
  }),
);
