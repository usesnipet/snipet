---
to: web/src/features/<%= h.kebab(name) %>/schemas.ts
---
<% const C = h.camel(name); const P = h.pascal(name); const Plural = h.pluralPascal(name); const kebab = h.kebab(name); -%>
import { z } from "zod";

import { paginatedSchema, paginationParamsSchema } from "@/schemas/paginated";

import { <%= C %>Schema } from "@/models/<%= kebab %>";

export { <%= C %>Schema } from "@/models/<%= kebab %>";
export type { <%= P %> } from "@/models/<%= kebab %>";

export const create<%= P %>Schema = <%= C %>Schema
  .pick({
<% zodFields.forEach(function (f) { -%>
    <%= f.key %>: true,
<% }); -%>
  })
  .strict();
export type Create<%= P %> = z.infer<typeof create<%= P %>Schema>;

export const update<%= P %>Schema = create<%= P %>Schema.partial().strict();
export type Update<%= P %> = z.infer<typeof update<%= P %>Schema>;

export const paginated<%= P %>Schema = paginatedSchema(<%= C %>Schema);
export type Paginated<%= P %> = z.infer<typeof paginated<%= P %>Schema>;

export const list<%= Plural %>SearchParamsSchema = paginationParamsSchema;
export type List<%= Plural %>SearchParams = z.infer<
  typeof list<%= Plural %>SearchParamsSchema
>;
