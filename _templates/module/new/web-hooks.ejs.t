---
to: web/src/features/<%= h.kebab(name) %>/hooks.ts
---
<% const C = h.camel(name); const P = h.pascal(name); const Plural = h.pluralPascal(name); const kebab = h.kebab(name); -%>
import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";

import { <%= C %>Service } from "./service";

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
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "<%= kebab %>";

export const list<%= Plural %>QueryKey = () => [BASE_QUERY_KEY] as const;
export const useList<%= Plural %> = (
  opts?: ServiceGetOptions<Paginated<%= P %>, List<%= Plural %>SearchParams>,
): UseQueryResult<Paginated<%= P %>, Error> =>
  useQuery({
    queryKey: [...list<%= Plural %>QueryKey(), opts?.searchParams],
    queryFn: () => <%= C %>Service.list(opts),
  });

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

export const useCreate<%= P %> = (
  opts?: ServicePostOptions<Create<%= P %>, <%= P %>>,
): UseMutationResult<<%= P %>, Error, Create<%= P %>> =>
  useMutation({
    mutationFn: (data: Create<%= P %>) => <%= C %>Service.create(data, opts),
    onSuccess: () => {
      toast({ title: "<%= P %> created" });
      queryClient.invalidateQueries({ queryKey: list<%= Plural %>QueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create <%= P %>", variant: "destructive" });
    },
  });

export const useUpdate<%= P %> = (
  id: string,
  opts?: ServicePutOptions<Update<%= P %>, void>,
): UseMutationResult<void, Error, Update<%= P %>> =>
  useMutation({
    mutationFn: (data: Update<%= P %>) => <%= C %>Service.update(id, data, opts),
    onSuccess: () => {
      toast({ title: "<%= P %> updated" });
      queryClient.invalidateQueries({ queryKey: list<%= Plural %>QueryKey() });
      queryClient.invalidateQueries({ queryKey: <%= C %>QueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update <%= P %>", variant: "destructive" });
    },
  });

export const useDelete<%= P %> = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => <%= C %>Service.delete(id, opts),
    onSuccess: () => {
      toast({ title: "<%= P %> deleted" });
      queryClient.invalidateQueries({ queryKey: list<%= Plural %>QueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete <%= P %>", variant: "destructive" });
    },
  });
