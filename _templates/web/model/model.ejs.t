---
to: web/src/models/<%= h.kebab(name) %>.ts
---
<% const C = h.camel(name); const P = h.pascal(name); -%>
import { z } from "zod";

// The <%= P %> entity — the read model as it comes off the API. Add relations
// here (import from "@/models/<other>"), never from another feature's schemas.
export const <%= C %>Schema = z
  .object({
    id: z.uuid(),
<% zodFields.forEach(function (f) { -%>
    <%= f.key %>: <%= f.zod %>,
<% }); -%>
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();

export type <%= P %> = z.infer<typeof <%= C %>Schema>;
