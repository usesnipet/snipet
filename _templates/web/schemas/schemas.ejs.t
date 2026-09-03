---
to: web/src/features/<%= h.kebab(name) %>/schemas.ts
---
<% const C = h.camel(name); const P = h.pascal(name); const kebab = h.kebab(name); -%>
import { z } from "zod";

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
