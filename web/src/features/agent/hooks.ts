import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";

import { agentService } from "./service";

import type { Agent, CreateAgent, ListAgentsSearchParams, PaginatedAgent, UpdateAgent } from "./schemas";
import type { ServiceGetOptions } from "@/lib/services";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "agent";

export const listAgentsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListAgents = (
  opts?: ServiceGetOptions<PaginatedAgent, ListAgentsSearchParams>,
): UseQueryResult<PaginatedAgent, Error> =>
  useQuery({
    queryKey: [...listAgentsQueryKey(), opts?.searchParams],
    queryFn: () => agentService.list(opts),
  });

// mutation wraps an agent write with a toast and a list refresh.
const mutation = <TVariables, TData>(fn: (vars: TVariables) => Promise<TData>, success: string, failure: string) => ({
  mutationFn: fn,
  onSuccess: () => {
    toast({ title: success });
    queryClient.invalidateQueries({ queryKey: listAgentsQueryKey() });
  },
  onError: () => {
    toast({ title: failure, variant: "destructive" });
  },
});

export const useCreateAgent = (): UseMutationResult<Agent, Error, CreateAgent> =>
  useMutation(mutation((data: CreateAgent) => agentService.create(data), "Agent created", "Failed to create agent"));

export const useUpdateAgent = (id: string): UseMutationResult<void, Error, UpdateAgent> =>
  useMutation(mutation((data: UpdateAgent) => agentService.update(id, data), "Agent updated", "Failed to update agent"));

export const useDeleteAgent = (): UseMutationResult<void, Error, string> =>
  useMutation(mutation((id: string) => agentService.delete(id), "Agent deleted", "Failed to delete agent"));
