---
to: web/src/features/<%= h.kebab(name) %>/hooks.ts
---
<% const C = h.camel(name); const P = h.pascal(name); const kebab = h.kebab(name); -%>
import { useQuery } from "@tanstack/react-query";

import { <%= C %>Service } from "./service";

import type { <%= P %> } from "./schemas";
import type { ServiceGetOptions } from "@/lib/services";
import type { UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "<%= kebab %>";

export const <%= C %>QueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const use<%= P %> = (
  id: string,
  opts?: ServiceGetOptions<<%= P %>>,
): UseQueryResult<<%= P %>, Error> =>
  useQuery({
    queryKey: <%= C %>QueryKey(id),
    queryFn: () => <%= C %>Service.findById(id, opts),
    enabled: !!id,
  });
