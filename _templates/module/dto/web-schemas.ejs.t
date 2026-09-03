---
to: web/src/features/<%= h.kebab(mod) %>/schemas.ts
inject: true
append: true
skip_if: export const <%= schemaName %>
---

export const <%= schemaName %> = z
  .object({
<% zodFields.forEach(function (f) { -%>
    <%= f.key %>: <%= f.zod %>,
<% }); -%>
  })
  .strict();
export type <%= typeName %> = z.infer<typeof <%= schemaName %>>;
