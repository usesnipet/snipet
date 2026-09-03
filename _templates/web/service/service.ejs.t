---
to: web/src/features/<%= h.kebab(name) %>/service.ts
---
<% const C = h.camel(name); const P = h.pascal(name); const CONST = h.constant(name); const kebab = h.kebab(name); -%>
import http from "@/lib/http";

import { <%= C %>Schema } from "./schemas";

import type { <%= P %> } from "./schemas";
import type { ServiceGetOptions } from "@/lib/services";

const <%= CONST %>_URL = "/api/<%= kebab %>";

const findById = async (
  id: string,
  opts: ServiceGetOptions<<%= P %>> = {},
): Promise<<%= P %>> =>
  http.get({
    url: `${<%= CONST %>_URL}/{id}`,
    params: { id },
    schemas: { response: <%= C %>Schema },
    ...opts,
  });

export const <%= C %>Service = { findById };
