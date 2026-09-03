---
to: web/src/features/<%= h.kebab(name) %>/service.ts
---
<% const C = h.camel(name); const P = h.pascal(name); const Plural = h.pluralPascal(name); const CONST = h.constant(name); const kebab = h.kebab(name); -%>
import http from "@/lib/http";

import {
  create<%= P %>Schema,
  list<%= Plural %>SearchParamsSchema,
  paginated<%= P %>Schema,
  update<%= P %>Schema,
  <%= C %>Schema,
} from "./schemas";

import type {
  Create<%= P %>,
  List<%= Plural %>SearchParams,
  Paginated<%= P %>,
  Update<%= P %>,
  <%= P %>,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";

const <%= CONST %>_URL = "/api/<%= kebab %>";

const list = async (
  opts: ServiceGetOptions<Paginated<%= P %>, List<%= Plural %>SearchParams> = {},
): Promise<Paginated<%= P %>> =>
  http.get({
    url: <%= CONST %>_URL,
    schemas: {
      response: paginated<%= P %>Schema,
      searchParams: list<%= Plural %>SearchParamsSchema,
    },
    ...opts,
  });

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

const create = async (
  body: Create<%= P %>,
  opts: ServicePostOptions<Create<%= P %>, <%= P %>> = {},
): Promise<<%= P %>> =>
  http.post({
    url: <%= CONST %>_URL,
    body,
    schemas: { body: create<%= P %>Schema, response: <%= C %>Schema },
    ...opts,
  });

const update = async (
  id: string,
  body: Update<%= P %>,
  opts: ServicePutOptions<Update<%= P %>, void> = {},
): Promise<void> =>
  http.put({
    url: `${<%= CONST %>_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: update<%= P %>Schema },
    ...opts,
  });

const remove = async (id: string, opts: ServiceDeleteOptions<void> = {}): Promise<void> =>
  http.delete({
    url: `${<%= CONST %>_URL}/{id}`,
    params: { id },
    ...opts,
  });

export const <%= C %>Service = { list, findById, create, update, delete: remove };
